'use client';

import React, { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Upload, FileText, CheckCircle2, Clock, AlertCircle, 
  Layers, Palette, Copy, FileCheck, ArrowRight, ShieldCheck, 
  Sparkles, RefreshCw, QrCode, MapPin, IndianRupee, Printer, ExternalLink,
  Eye, RotateCw, CreditCard, BookOpen, ChevronLeft, ChevronRight, ScrollText, Smartphone
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  getShopBySlugFromCloud, createOrderInCloud, subscribeToSingleOrderRealtime, 
  uploadDocumentToStorage 
} from '@/lib/firebase';
import { calculateOrderPrice } from '@/lib/store';
import { playNewOrderChime } from '@/lib/sound';
import { Shop, ColorMode, PaperSize, Order, Orientation, UploadMode, IdLayoutMode } from '@/types';

interface PaperSpec {
  id: PaperSize;
  label: string;
  widthMm: number;
  heightMm: number;
  desc: string;
  badge: string;
}

const PAPER_SPECS: Record<PaperSize, PaperSpec> = {
  A4: { id: 'A4', label: 'A4 Standard', widthMm: 210, heightMm: 297, desc: '210 × 297 mm', badge: 'Assignments & Notes' },
  LEGAL: { id: 'LEGAL', label: 'Legal / Stamp', widthMm: 216, heightMm: 356, desc: '216 × 356 mm', badge: 'Court / Affidavits / Deeds' },
  A3: { id: 'A3', label: 'A3 Jumbo', widthMm: 297, heightMm: 420, desc: '297 × 420 mm', badge: 'Drawings & Charts' },
  A5: { id: 'A5', label: 'A5 Booklet', widthMm: 148, heightMm: 210, desc: '148 × 210 mm', badge: 'Vouchers & Receipts' },
  PHOTO_4X6: { id: 'PHOTO_4X6', label: '4×6 Photo', widthMm: 100, heightMm: 150, desc: '100 × 150 mm', badge: 'Glossy Photo Print' },
  LETTER: { id: 'LETTER', label: 'Letterhead', widthMm: 216, heightMm: 279, desc: '216 × 279 mm', badge: 'Corporate Letters' },
  B5: { id: 'B5', label: 'B5 Book', widthMm: 176, heightMm: 250, desc: '176 × 250 mm', badge: 'Books & Test Papers' },
};

/**
 * Robust Custom Page Range Parser
 * Parses strings like '1-3, 5, 8' into sorted, deduplicated number array: [1, 2, 3, 5, 8]
 */
function parsePageRange(rangeStr: string, maxPages?: number): number[] {
  if (!rangeStr || !rangeStr.trim()) return [];
  const pages = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        const clampedStart = maxPages && maxPages > 0 ? Math.min(start, maxPages) : start;
        const clampedEnd = maxPages && maxPages > 0 ? Math.min(end, maxPages) : end;
        for (let i = clampedStart; i <= clampedEnd; i++) {
          pages.add(i);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p > 0) {
        if (maxPages && maxPages > 0) {
          if (p <= maxPages) pages.add(p);
        } else {
          pages.add(p);
        }
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export default function ShopUploadPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [shop, setShop] = useState<Shop | null>(null);
  const [loadingShop, setLoadingShop] = useState(true);

  // Upload Mode: Standard Single Document vs ID Card & Passbook (Front + Back)
  const [uploadMode, setUploadMode] = useState<UploadMode>('SINGLE');
  const [idLayoutMode, setIdLayoutMode] = useState<IdLayoutMode>('SAME_SIDE');

  // Primary / Front File States
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<'pdf' | 'image' | 'other'>('other');

  // Back File States (For ID Card / Passbook 2-sided upload)
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backFileName, setBackFileName] = useState('');
  const [backFileSizeStr, setBackFileSizeStr] = useState('');
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);
  const [backPreviewFileType, setBackPreviewFileType] = useState<'pdf' | 'image' | 'other'>('other');

  // Upload progress & loading
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Print Configuration States
  const [colorMode, setColorMode] = useState<ColorMode>('BW');
  const [orientation, setOrientation] = useState<Orientation>('PORTRAIT');
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [previewViewMode, setPreviewViewMode] = useState<'sheet' | 'scroll'>('sheet');
  const [isDuplex, setIsDuplex] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [copies, setCopies] = useState(1);
  const [pageSelectionType, setPageSelectionType] = useState<'all' | 'custom'>('all');
  const [customPageRange, setCustomPageRange] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Payment & Order Placement States
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [upiUtr, setUpiUtr] = useState('');

  // Load shop from Firestore
  useEffect(() => {
    async function loadShop() {
      setLoadingShop(true);
      const cloudShop = await getShopBySlugFromCloud(slug);
      setShop(cloudShop);
      setLoadingShop(false);
    }
    loadShop();
  }, [slug]);

  // Cleanup preview object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl);
    };
  }, [previewUrl, backPreviewUrl]);

  // Real-time listener for active order updates
  useEffect(() => {
    if (!activeOrder?.id) return;
    const unsubscribe = subscribeToSingleOrderRealtime(activeOrder.id, (updatedOrder) => {
      if (updatedOrder) {
        setActiveOrder(updatedOrder);
      }
    });
    return () => unsubscribe();
  }, [activeOrder?.id]);

  // Handle Primary / Front file selection
  const handleFileSelection = async (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileSizeStr((selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB');

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const objUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objUrl);

    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    const isImg = selectedFile.type.startsWith('image/');
    setPreviewFileType(isPdf ? 'pdf' : isImg ? 'image' : 'other');

    if (isPdf) {
      setIsParsingPdf(true);
      try {
        const { PDFDocument } = await import('pdf-lib');
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        setPageCount(count > 0 ? count : 1);
      } catch (err) {
        console.warn('PDF-lib fallback to 1 page:', err);
        setPageCount(1);
      } finally {
        setIsParsingPdf(false);
      }
    } else {
      setPageCount(1);
    }
    setPreviewPageIndex(0);
  };

  // Handle Back file selection (ID Card / Passbook)
  const handleBackFileSelection = (selectedFile: File) => {
    setBackFile(selectedFile);
    setBackFileName(selectedFile.name);
    setBackFileSizeStr((selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB');

    if (backPreviewUrl) {
      URL.revokeObjectURL(backPreviewUrl);
    }
    const objUrl = URL.createObjectURL(selectedFile);
    setBackPreviewUrl(objUrl);

    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    const isImg = selectedFile.type.startsWith('image/');
    setBackPreviewFileType(isPdf ? 'pdf' : isImg ? 'image' : 'other');
  };

  // Calculate parsed custom pages list
  const parsedCustomPages = (pageSelectionType === 'custom' && customPageRange.trim())
    ? parsePageRange(customPageRange, pageCount > 1 ? pageCount : undefined)
    : [];

  // Active list of pages to preview / print
  const activePagesList: number[] = (pageSelectionType === 'custom' && parsedCustomPages.length > 0)
    ? parsedCustomPages
    : Array.from({ length: Math.max(1, pageCount) }, (_, i) => i + 1);

  // Effective page count for pricing & spooler
  const effectivePageCount = (() => {
    if (uploadMode === 'ID_DOUBLE_SIDED') {
      return idLayoutMode === 'SAME_SIDE' ? 1 : 2;
    }
    if (pageSelectionType === 'custom' && customPageRange.trim()) {
      return parsedCustomPages.length > 0 ? parsedCustomPages.length : pageCount;
    }
    return pageCount;
  })();

  const currentPaperSpec = PAPER_SPECS[paperSize] || PAPER_SPECS.A4;
  const isPortrait = orientation === 'PORTRAIT';
  const displayWidthMm = isPortrait ? currentPaperSpec.widthMm : currentPaperSpec.heightMm;
  const displayHeightMm = isPortrait ? currentPaperSpec.heightMm : currentPaperSpec.widthMm;
  const paperAspectRatio = displayWidthMm / displayHeightMm;

  // Safe index of active page in preview
  const safePageIndex = Math.min(previewPageIndex, activePagesList.length - 1);
  const currentPreviewDocPage = activePagesList[safePageIndex] || 1;

  if (loadingShop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center space-y-3">
          <div className="inline-block h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent"></div>
          <p className="text-slate-700 font-bold text-sm">Connecting to Print Station...</p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Print Shop Not Found</h2>
          <p className="text-xs text-slate-500">
            No active print counter is registered at <span className="font-mono font-bold text-slate-800">/shop/{slug}</span>.
          </p>
          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow hover:bg-indigo-700"
            >
              <span>Register This Shop URL Now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const effectiveDuplex = uploadMode === 'ID_DOUBLE_SIDED' ? (idLayoutMode === 'SEPARATE_SIDES') : isDuplex;

  const pricingSummary = calculateOrderPrice(
    shop.pricing,
    effectivePageCount,
    colorMode,
    effectiveDuplex,
    copies,
    paperSize,
    []
  );

  // Place Order & Upload Document(s)
  const handlePlaceOrder = async (paymentType: 'UPI' | 'CASH') => {
    if (!file) return;
    setIsUploading(true);

    try {
      let fileDownloadUrl = '';
      let uploadedPublicId = '';
      let backFileDownloadUrl = '';
      let backUploadedPublicId = '';

      // 1. Upload Front / Primary Document
      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('shopId', shop.id);
        uploadFormData.append('orderId', 'ord_' + Date.now());

        setUploadProgress(25);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          fileDownloadUrl = uploadData.fileUrl;
          uploadedPublicId = uploadData.publicId || '';
        } else {
          fileDownloadUrl = await uploadDocumentToStorage(file, shop.id, (percent) => {
            setUploadProgress(percent);
          });
        }
      } catch (err) {
        console.warn('Front file upload fallback:', err);
        fileDownloadUrl = URL.createObjectURL(file);
      }

      // 2. Upload Back File (if in ID mode)
      if (uploadMode === 'ID_DOUBLE_SIDED' && backFile) {
        try {
          const backFormData = new FormData();
          backFormData.append('file', backFile);
          backFormData.append('shopId', shop.id);
          backFormData.append('orderId', 'ord_back_' + Date.now());

          setUploadProgress(60);
          const backRes = await fetch('/api/upload', {
            method: 'POST',
            body: backFormData
          });

          if (backRes.ok) {
            const backData = await backRes.json();
            backFileDownloadUrl = backData.fileUrl;
            backUploadedPublicId = backData.publicId || '';
          }
        } catch (backErr) {
          console.warn('Back file upload fallback:', backErr);
          backFileDownloadUrl = URL.createObjectURL(backFile);
        }
      }

      setUploadProgress(100);

      // 3. Generate Token
      const tokenSuffix = Math.floor(100 + Math.random() * 900);
      const tokenLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      const tokenNumber = `${tokenLetter}-${tokenSuffix}`;

      // 4. Save Order in Cloud Firestore
      const orderPayload: any = {
        tokenNumber,
        shopId: shop.id,
        shopSlug: shop.slug,
        customerPhone: customerPhone || '9876543210',
        uploadMode,
        fileName: uploadMode === 'ID_DOUBLE_SIDED' && backFile ? `${file.name} + ${backFile.name}` : file.name,
        fileSizeBytes: file.size + (backFile ? backFile.size : 0),
        fileUrl: fileDownloadUrl,
        pageCount: uploadMode === 'ID_DOUBLE_SIDED' ? (idLayoutMode === 'SAME_SIDE' ? 1 : 2) : pageCount,
        selectedPages: uploadMode === 'ID_DOUBLE_SIDED' 
          ? (idLayoutMode === 'SAME_SIDE' ? 'ID_SAME_SIDE' : 'ID_DUPLEX')
          : (pageSelectionType === 'all' ? 'ALL' : customPageRange),
        effectivePageCount,
        colorMode,
        isDuplex: effectiveDuplex,
        paperSize,
        orientation,
        copies,
        additionalServices: [],
        totalAmountPaise: pricingSummary.grandTotalPaise,
        paymentStatus: paymentType === 'UPI' ? 'PAID' : 'CASH_AT_COUNTER',
        paymentId: paymentType === 'UPI' ? (upiUtr.trim() ? `UTR: ${upiUtr.trim()}` : `UPI_${Date.now()}`) : `CASH_${Date.now()}`,
        printStatus: shop.autoPrintOnUpi && paymentType === 'UPI' ? 'PRINTING' : 'QUEUED',
        targetPrinterName: colorMode === 'COLOR' 
          ? shop.activePrinters?.find(p => p.supportsColor)?.name || 'Color Printer' 
          : shop.activePrinters?.find(p => !p.supportsColor)?.name || 'Laser B&W',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (uploadedPublicId) orderPayload.publicId = uploadedPublicId;
      if (uploadMode === 'ID_DOUBLE_SIDED') {
        orderPayload.idLayoutMode = idLayoutMode;
        if (backFile) orderPayload.backFileName = backFile.name;
        if (backFileDownloadUrl) orderPayload.backFileUrl = backFileDownloadUrl;
        if (backUploadedPublicId) orderPayload.backPublicId = backUploadedPublicId;
      }

      const newOrder = await createOrderInCloud(orderPayload);

      setActiveOrder(newOrder);
      setIsCheckingOut(false);
      playNewOrderChime();

      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {}
    } catch (error: any) {
      console.error('Error placing order:', error);
      alert(`Could not submit order: ${error?.message || 'Please check your network connection and try again.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const upiPayLink = `upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.name)}&am=${pricingSummary.grandTotalRupees.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`PagePrint ${shop.slug}`)}`;
  const upiQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiPayLink)}`;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-32 sm:pb-28">
      {/* Top Banner & Shop Header - Mobile Optimized */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-3xl px-3.5 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-xl border-2 border-indigo-100 bg-white p-0.5 shadow-sm">
                <Image src="/logo.png" alt="PagePrint Logo" fill className="object-contain" priority />
              </div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  Page<span className="text-indigo-600">Print</span>
                </span>
                <span className="text-[10px] text-slate-500 font-semibold leading-none">
                  Instant Print Station
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Printer Live</span>
            </div>
          </div>

          {/* Shop Card with Tap-to-Call */}
          <div className="mt-2.5 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 p-3.5 sm:p-4 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[9px] font-bold tracking-widest text-indigo-300 uppercase block">
                  Verified Counter
                </span>
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate mt-0.5">
                  {shop.name}
                </h1>
                <p className="flex items-center gap-1 text-[11px] text-slate-300 truncate mt-0.5">
                  <MapPin className="h-3 w-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{shop.address}</span>
                </p>
              </div>
              
            </div>
          </div>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="mx-auto max-w-3xl px-3.5 py-4 sm:px-6 space-y-4 sm:space-y-6">
        {activeOrder ? (
          /* Active Order Tracking Screen */
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-3xl bg-white p-5 sm:p-8 shadow-sm border border-slate-200 text-center space-y-4">
              <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>

              {/* Token Number */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  activeOrder.paymentStatus === 'PAID' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {activeOrder.paymentStatus === 'PAID' ? 'Order Paid via UPI' : 'Pay Cash at Counter'}
                </span>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-2.5">
                  TOKEN #{activeOrder.tokenNumber}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {activeOrder.paymentStatus === 'PAID'
                    ? 'Your document is auto-printing now. Wait for paper to exit the tray!'
                    : 'Please pay cash to the shopkeeper at the counter to release your print!'}
                </p>
              </div>

              {/* Mobile Progress Flow */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-3 border-t border-slate-100">
                <div className={`text-center p-2 sm:p-3 rounded-xl border ${
                  activeOrder.paymentStatus === 'PAID' 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <span className="text-[9px] font-bold text-slate-600 block">STEP 1</span>
                  <span className={`text-[11px] sm:text-xs font-bold leading-tight block mt-0.5 ${
                    activeOrder.paymentStatus === 'PAID' ? 'text-emerald-900' : 'text-amber-900'
                  }`}>
                    {activeOrder.paymentStatus === 'PAID' ? 'Paid via UPI' : 'Pay at Counter'}
                  </span>
                </div>
                <div className={`text-center p-2 sm:p-3 rounded-xl border ${
                  activeOrder.printStatus === 'PRINTING' 
                    ? 'bg-amber-50 border-amber-300 animate-pulse' 
                    : activeOrder.printStatus === 'PRINTED' 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[9px] font-bold text-slate-500 block">STEP 2</span>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight block mt-0.5">
                    {activeOrder.printStatus === 'PRINTING' ? 'Printing...' : activeOrder.printStatus === 'PRINTED' ? 'Printed' : 'Waiting for Shop'}
                  </span>
                </div>
                <div className={`text-center p-2 sm:p-3 rounded-xl border ${
                  activeOrder.printStatus === 'PRINTED' 
                    ? 'bg-emerald-100 border-emerald-300 font-bold text-emerald-900' 
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  <span className="text-[9px] font-bold block">STEP 3</span>
                  <span className="text-[11px] sm:text-xs font-bold leading-tight block mt-0.5">Ready for Pickup</span>
                </div>
              </div>

              {/* Order Summary Specs */}
              <div className="rounded-2xl bg-slate-50 p-3.5 sm:p-4 text-left text-xs space-y-2 text-slate-600 border border-slate-100">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">File Name:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[180px] sm:max-w-[240px]">{activeOrder.fileName}</span>
                </div>
                {activeOrder.uploadMode === 'ID_DOUBLE_SIDED' && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Print Style:</span>
                    <span className="font-bold text-indigo-700">
                      Front + Back ({activeOrder.idLayoutMode === 'SAME_SIDE' ? 'Both on 1 Sheet' : 'Two-Sided Duplex'})
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Print Mode:</span>
                  <span className="font-semibold text-slate-800">
                    {activeOrder.colorMode === 'COLOR' ? 'Color' : 'Black & White'} · {activeOrder.isDuplex ? 'Both Sides (Duplex)' : 'Single Sided'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Paper & Orientation:</span>
                  <span className="font-semibold text-slate-800">
                    {activeOrder.paperSize || 'A4'} · {activeOrder.orientation === 'LANDSCAPE' ? 'Landscape (Horizontal ↔)' : 'Portrait (Vertical ↕)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pages & Copies:</span>
                  <span className="font-semibold text-slate-800">
                    {activeOrder.effectivePageCount} pages ({activeOrder.selectedPages}) × {activeOrder.copies} copy
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-slate-900 text-sm sm:text-base">
                  <span>Total Paid:</span>
                  <span className="text-indigo-600">₹{(activeOrder.totalAmountPaise / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl);
                    setPreviewUrl(null);
                    setBackPreviewUrl(null);
                    setFile(null);
                    setBackFile(null);
                    setActiveOrder(null);
                  }}
                  className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white active:bg-slate-800 transition"
                >
                  Print Another Document
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {/* 1. Document Type Mode Selector - Mobile Ergonomic */}
            <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  1. What are you printing?
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Step 1 of 2
                </span>
              </div>

              {/* Mode Tabs: Single Doc vs ID Card / Passbook */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setUploadMode('SINGLE')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-left flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 transition active:scale-[0.98] ${
                    uploadMode === 'SINGLE'
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-600/20 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${uploadMode === 'SINGLE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-sm sm:text-base font-black text-slate-900 leading-tight">Single Document</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-none block mt-0.5">PDF, Word, 1 Photo</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadMode('ID_DOUBLE_SIDED')}
                  className={`p-3 sm:p-3.5 rounded-2xl border text-left flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 transition active:scale-[0.98] ${
                    uploadMode === 'ID_DOUBLE_SIDED'
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-600/20 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${uploadMode === 'ID_DOUBLE_SIDED' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-base sm:text-lg font-black text-indigo-950 leading-tight">Front + Back</span>
                    <span className="text-[10px] sm:text-[11px] text-indigo-600 font-semibold leading-none block mt-0.5">Upload Both Sides</span>
                  </div>
                </button>
              </div>

              {/* Upload Dropzones */}
              {uploadMode === 'SINGLE' ? (
                /* SINGLE DOCUMENT UPLOAD */
                <div className="pt-1">
                  {!file ? (
                    <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl p-6 sm:p-8 text-center bg-indigo-50/20 active:bg-indigo-50/40 transition cursor-pointer group">
                      <input
                        type="file"
                        accept=".pdf,image/*,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelection(e.target.files[0]);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      />
                      <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 group-hover:scale-110 transition-transform">
                        <Upload className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <p className="mt-2.5 text-sm font-bold text-slate-800">
                        Tap here to select file from mobile
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        PDF, Photos, Word documents (up to 50 MB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                      <div className="flex items-center gap-3 truncate min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          {previewFileType === 'pdf' ? 'PDF' : previewFileType === 'image' ? 'IMG' : 'DOC'}
                        </div>
                        <div className="truncate min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {fileName}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{fileSizeStr}</span>
                            <span>•</span>
                            {isParsingPdf ? (
                              <span className="text-amber-600 font-semibold animate-pulse">Counting pages...</span>
                            ) : (
                              <span className="font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded text-[10px]">
                                {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (previewUrl) URL.revokeObjectURL(previewUrl);
                          setPreviewUrl(null);
                          setFile(null);
                        }}
                        className="text-xs font-bold text-rose-600 active:text-rose-700 px-3 py-2 shrink-0 rounded-xl bg-white border border-rose-200 shadow-xs"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* TWO-SIDED ID CARD & PASSBOOK UPLOAD (FRONT + BACK) */
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    {/* Front Side Dropzone */}
                    <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                          1. Front Side (Photo/Page 1)
                        </span>
                        {file && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">✓ Attached</span>
                        )}
                      </div>

                      {!file ? (
                        <div className="relative border-2 border-dashed border-indigo-200 rounded-xl p-3.5 text-center bg-white cursor-pointer active:bg-indigo-50/30 transition">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileSelection(e.target.files[0]);
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <Upload className="h-5 w-5 text-indigo-500 mx-auto" />
                          <p className="text-xs font-bold text-slate-800 mt-1">
                            Tap to Upload Front Side
                          </p>
                          <p className="text-[10px] text-slate-400">Front side photo or PDF</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                          <div className="flex items-center gap-2 truncate">
                            {previewUrl && previewFileType === 'image' ? (
                              <img src={previewUrl} alt="Front" className="h-8 w-8 object-cover rounded-lg" />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-[9px] flex items-center justify-center">
                                FRONT
                              </div>
                            )}
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{fileName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (previewUrl) URL.revokeObjectURL(previewUrl);
                              setPreviewUrl(null);
                              setFile(null);
                            }}
                            className="text-xs text-rose-600 font-bold px-2 py-1"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Back Side Dropzone */}
                    <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-purple-600"></span>
                          2. Back Side (Address/Page 2)
                        </span>
                        {backFile && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">✓ Attached</span>
                        )}
                      </div>

                      {!backFile ? (
                        <div className="relative border-2 border-dashed border-purple-200 rounded-xl p-3.5 text-center bg-white cursor-pointer active:bg-purple-50/30 transition">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleBackFileSelection(e.target.files[0]);
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <Upload className="h-5 w-5 text-purple-500 mx-auto" />
                          <p className="text-xs font-bold text-slate-800 mt-1">
                            Tap to Upload Back Side
                          </p>
                          <p className="text-[10px] text-slate-400">Back side photo or PDF</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                          <div className="flex items-center gap-2 truncate">
                            {backPreviewUrl && backPreviewFileType === 'image' ? (
                              <img src={backPreviewUrl} alt="Back" className="h-8 w-8 object-cover rounded-lg" />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 font-bold text-[9px] flex items-center justify-center">
                                BACK
                              </div>
                            )}
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{backFileName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl);
                              setBackPreviewUrl(null);
                              setBackFile(null);
                            }}
                            className="text-xs text-rose-600 font-bold px-2 py-1"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ID Print Layout Selector */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-700 block mb-2">
                      Print Layout on Paper:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIdLayoutMode('SAME_SIDE')}
                        className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] ${
                          idLayoutMode === 'SAME_SIDE'
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-600/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <span className="block text-xs font-bold leading-tight">Same Side (Xerox)</span>
                        <span className="text-[10px] text-slate-500 font-normal leading-tight block mt-1">
                          Both Front & Back on 1 sheet (Cost: 1 page)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIdLayoutMode('SEPARATE_SIDES')}
                        className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] ${
                          idLayoutMode === 'SEPARATE_SIDES'
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-600/20'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <span className="block text-xs font-bold leading-tight">Two-Sided (Duplex)</span>
                        <span className="text-[10px] text-slate-500 font-normal leading-tight block mt-1">
                          Front on Side A, Back on Side B (Cost: 2 pages)
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 100% Private Instant Delete Guarantee */}
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 border border-emerald-200/70 shadow-2xs mt-3">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>100% Private: Documents are instantly deleted from storage right after printing.</span>
              </div>
            </div>

            {/* 1.5 Live Paper Print Preview Card */}
            {(file || backFile) && (
              <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3">
                {/* Header & Orientation Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Eye className="h-4 w-4 text-indigo-600" />
                        Live Paper Print Preview
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase">
                        Scale 1:1
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {currentPaperSpec.label} ({displayWidthMm} × {displayHeightMm} mm) • {isPortrait ? 'Portrait ↕' : 'Landscape ↔'}
                    </p>
                  </div>

                  {/* Orientation Toggles */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setOrientation('PORTRAIT')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                        isPortrait
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <span className="inline-block w-2.5 h-3.5 border-2 border-current rounded-xs"></span>
                      <span>Portrait</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation('LANDSCAPE')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                        !isPortrait
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <span className="inline-block w-3.5 h-2.5 border-2 border-current rounded-xs"></span>
                      <span>Landscape</span>
                    </button>
                  </div>
                </div>

                {/* Duplex Flip Selector (When Duplex is active in either mode) */}
                {effectiveDuplex && (
                  <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/70 rounded-xl px-3 py-2 text-xs">
                    <span className="font-bold text-blue-950 flex items-center gap-1.5 text-[11px] sm:text-xs">
                      <Layers className="h-3.5 w-3.5 text-blue-600" />
                      Two-Sided Duplex
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewSide('front')}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                          previewSide === 'front'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-blue-700 border border-blue-200'
                        }`}
                      >
                        Side 1 (Front)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewSide('back')}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                          previewSide === 'back'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-blue-700 border border-blue-200'
                        }`}
                      >
                        Side 2 (Back)
                      </button>
                    </div>
                  </div>
                )}

                {/* The Paper Simulation Stage (Clean & Responsive) */}
                <div className="relative rounded-2xl bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200/90 border border-slate-200 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[340px] sm:min-h-[400px] overflow-hidden shadow-inner">
                  {/* Cutting Mat Subtle Grid */}
                  <div
                    className="absolute inset-0 opacity-[0.06] pointer-events-none"
                    style={{
                      backgroundImage: 'radial-gradient(circle, #0f172a 1px, transparent 1px)',
                      backgroundSize: '16px 16px'
                    }}
                  />

                  {/* Corner Dimension Badge */}
                  <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-xs border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold shadow-xs z-10">
                    <span>{displayWidthMm} × {displayHeightMm} mm</span>
                  </div>

                  {/* Corner Color Badge */}
                  <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-xs border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-semibold shadow-xs flex items-center gap-1.5 z-10">
                    <span className={`h-2 w-2 rounded-full ${colorMode === 'COLOR' ? 'bg-gradient-to-r from-rose-500 to-amber-400' : 'bg-slate-700'}`}></span>
                    <span>{colorMode === 'COLOR' ? 'Color' : 'B&W'}</span>
                  </div>

                  {/* The Physical Simulated Paper Sheet */}
                  <div
                    style={{
                      aspectRatio: `${paperAspectRatio}`,
                      width: isPortrait 
                        ? (paperSize === 'LEGAL' ? 'min(235px, 68vw)' : paperSize === 'PHOTO_4X6' ? 'min(200px, 60vw)' : 'min(265px, 72vw)') 
                        : (paperSize === 'A3' ? 'min(380px, 88vw)' : paperSize === 'LEGAL' ? 'min(360px, 86vw)' : 'min(340px, 84vw)'),
                      maxWidth: '92%',
                      filter: colorMode === 'BW' ? 'grayscale(100%) contrast(1.12)' : 'none',
                    }}
                    className="bg-white rounded-xs shadow-[0_20px_45px_rgba(15,23,42,0.16),0_4px_10px_rgba(15,23,42,0.06)] border border-slate-300 relative transition-all duration-300 flex flex-col justify-between overflow-hidden select-none"
                  >
                    {/* Safe Printable Margin Guide */}
                    <div className="absolute inset-2 sm:inset-3 border border-dashed border-indigo-200 pointer-events-none rounded-xs z-20 flex flex-col justify-between p-1">
                      <div className="flex justify-between text-[7px] font-mono text-indigo-400/80 leading-none">
                        <span>0 mm</span>
                        <span>{displayWidthMm} mm</span>
                      </div>
                      <div className="flex justify-between text-[7px] font-mono text-indigo-400/80 leading-none">
                        <span>5mm Margin</span>
                        <span>{displayHeightMm} mm</span>
                      </div>
                    </div>

                    {/* Paper Content Rendering */}
                    <div className="w-full h-full relative z-10 flex flex-col items-center justify-center p-2 bg-white overflow-hidden">
                      {uploadMode === 'ID_DOUBLE_SIDED' ? (
                        /* ID CARD / PASSBOOK PREVIEW */
                        idLayoutMode === 'SAME_SIDE' ? (
                          /* Both Front & Back on Single Sheet (Classic Indian Xerox style) */
                          <div className="w-full h-full flex flex-col justify-around p-1.5 bg-white space-y-2">
                            {/* Front Card Half */}
                            <div className="flex-1 w-full border border-dashed border-indigo-300/80 rounded-lg p-1.5 flex flex-col items-center justify-center relative bg-indigo-50/20">
                              <span className="absolute top-1 left-1.5 bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.2 rounded uppercase">
                                Front Side
                              </span>
                              {previewUrl ? (
                                previewFileType === 'image' ? (
                                  <img src={previewUrl} alt="Front ID" className="max-h-[85px] sm:max-h-[105px] max-w-[90%] object-contain rounded shadow-xs" />
                                ) : (
                                  <iframe src={`${previewUrl}#toolbar=0&navpanes=0&view=Fit`} className="w-full h-full border-0 rounded" title="Front PDF" />
                                )
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Front Not Attached</span>
                              )}
                            </div>

                            {/* Back Card Half */}
                            <div className="flex-1 w-full border border-dashed border-purple-300/80 rounded-lg p-1.5 flex flex-col items-center justify-center relative bg-purple-50/20">
                              <span className="absolute top-1 left-1.5 bg-purple-600 text-white text-[8px] font-bold px-1.5 py-0.2 rounded uppercase">
                                Back Side
                              </span>
                              {backPreviewUrl ? (
                                backPreviewFileType === 'image' ? (
                                  <img src={backPreviewUrl} alt="Back ID" className="max-h-[85px] sm:max-h-[105px] max-w-[90%] object-contain rounded shadow-xs" />
                                ) : (
                                  <iframe src={`${backPreviewUrl}#toolbar=0&navpanes=0&view=Fit`} className="w-full h-full border-0 rounded" title="Back PDF" />
                                )
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Back Not Attached</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Duplex Two-Sided ID Print */
                          <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-white">
                            {previewSide === 'front' ? (
                              <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-2">
                                <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                                  Side 1: Front of ID Card
                                </span>
                                {previewUrl ? (
                                  <img src={previewUrl} alt="Front ID" className="max-h-[150px] max-w-[90%] object-contain rounded shadow-sm" />
                                ) : (
                                  <span className="text-xs text-slate-400">Front Not Attached</span>
                                )}
                              </div>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-2">
                                <span className="text-[9px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                                  Side 2: Back of ID Card
                                </span>
                                {backPreviewUrl ? (
                                  <img src={backPreviewUrl} alt="Back ID" className="max-h-[150px] max-w-[90%] object-contain rounded shadow-sm" />
                                ) : (
                                  <span className="text-xs text-slate-400">Back Not Attached</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        /* STANDARD SINGLE DOCUMENT PREVIEW */
                        previewSide === 'back' && effectiveDuplex ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-slate-50/60 rounded space-y-2 border border-slate-100">
                            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                              2
                            </div>
                            <span className="text-xs font-bold text-slate-800">
                              Back Side of Sheet (Page 2)
                            </span>
                            <p className="text-[10px] text-slate-400 max-w-[170px] leading-relaxed">
                              Duplex reverse output on {currentPaperSpec.label}
                            </p>
                          </div>
                        ) : previewFileType === 'image' && previewUrl ? (
                          <div className="w-full h-full flex items-center justify-center overflow-hidden p-1">
                            <img
                              src={previewUrl}
                              alt="Document Preview"
                              className="w-full h-full object-contain pointer-events-none select-none rounded-xs"
                            />
                          </div>
                        ) : previewFileType === 'pdf' && previewUrl ? (
                          <div className="w-full h-full relative overflow-auto flex flex-col bg-white">
                            <iframe
                              key={`preview-pdf-p${currentPreviewDocPage}`}
                              src={`${previewUrl}#page=${currentPreviewDocPage}&toolbar=0&navpanes=0&view=Fit`}
                              className="w-full h-full border-0 rounded-xs bg-white"
                              title="PDF Document Sheet Preview"
                            />
                            <div className="absolute bottom-1 right-1 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                              Page {currentPreviewDocPage} of {pageCount}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full p-4 flex flex-col justify-between text-left">
                            <div className="space-y-2">
                              <div className="h-3 w-1/3 bg-indigo-600/30 rounded"></div>
                              <div className="h-2 w-full bg-slate-200 rounded"></div>
                              <div className="h-2 w-5/6 bg-slate-200 rounded"></div>
                            </div>
                            <div className="my-auto py-2 text-center">
                              <FileText className="h-8 w-8 text-indigo-400 mx-auto opacity-70" />
                              <span className="text-[11px] font-bold text-slate-700 block mt-1 truncate px-2">
                                {fileName}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {pageCount} {pageCount === 1 ? 'Page' : 'Pages'} • {fileSizeStr}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="h-2 w-full bg-slate-200 rounded"></div>
                              <div className="h-2 w-2/3 bg-slate-200 rounded"></div>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gradient-to-tl from-slate-200 to-transparent pointer-events-none"></div>
                  </div>

                  <div className="mt-3 text-center">
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                      Simulated Sheet: <strong className="text-slate-800">{currentPaperSpec.label}</strong> ({displayWidthMm} × {displayHeightMm} mm)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 1.6 OUTSIDE OF PRINT PREVIEW - BIG MOBILE SCROLL & PAGE CONTROLLER */}
            {uploadMode === 'SINGLE' && file && activePagesList.length > 1 && (
              <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border-2 border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      Page Navigator & Document Scroll
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                    Page {currentPreviewDocPage} of {pageCount}
                  </span>
                </div>

                {/* Big Chunky Touch Navigation Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={safePageIndex <= 0}
                    onClick={() => setPreviewPageIndex(prev => Math.max(0, prev - 1))}
                    className="h-13 sm:h-14 py-3 px-4 rounded-2xl bg-white border-2 border-slate-300 text-slate-800 font-bold text-sm sm:text-base flex items-center justify-center gap-2 active:bg-slate-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition"
                  >
                    <ChevronLeft className="h-5 w-5 text-slate-600" />
                    <span>◀ Prev Page</span>
                  </button>

                  <button
                    type="button"
                    disabled={safePageIndex >= activePagesList.length - 1}
                    onClick={() => setPreviewPageIndex(prev => Math.min(activePagesList.length - 1, prev + 1))}
                    className="h-13 sm:h-14 py-3 px-4 rounded-2xl bg-indigo-600 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md active:bg-indigo-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <span>Next Page ▶</span>
                    <ChevronRight className="h-5 w-5 text-white" />
                  </button>
                </div>

                {/* Big Touch Page Number Pills (Thumb-Scrollable) */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 block mb-2">
                    Tap page number to inspect:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                    {activePagesList.map((pNum, idx) => (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setPreviewPageIndex(idx)}
                        className={`h-11 min-w-[46px] px-3 rounded-xl font-mono text-sm font-bold transition shrink-0 active:scale-95 flex items-center justify-center ${
                          idx === safePageIndex
                            ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 active:bg-slate-200'
                        }`}
                      >
                        {pNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Color, Orientation, Duplex & Range Options - Mobile Ergonomic */}
            <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">2. Print Preferences</h3>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Step 2 of 2
                </span>
              </div>

              {/* Color Mode Tabs - Large Touch Tiles */}
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-1.5">Color Preference</span>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setColorMode('BW')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition active:scale-[0.98] ${
                      colorMode === 'BW'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="block text-xs sm:text-sm font-bold">Black & White</span>
                      <span className="text-[11px] font-semibold text-slate-500">₹{(shop.pricing.bwSinglePaise / 100).toFixed(2)}/page</span>
                    </div>
                    <div className="h-5 w-5 rounded-full border border-slate-400 bg-slate-800 shrink-0"></div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setColorMode('COLOR')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition active:scale-[0.98] ${
                      colorMode === 'COLOR'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="block text-xs sm:text-sm font-bold">Full Color</span>
                      <span className="text-[11px] font-semibold text-slate-500">₹{(shop.pricing.colorSinglePaise / 100).toFixed(2)}/page</span>
                    </div>
                    <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 to-cyan-500 shrink-0"></div>
                  </button>
                </div>
              </div>

              {/* Page Orientation Selector - Large Touch Tiles */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500">Page Orientation</span>
                  <span className="text-[11px] font-bold text-indigo-600">
                    {isPortrait ? 'Portrait (Vertical ↕)' : 'Landscape (Horizontal ↔)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setOrientation('PORTRAIT')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition active:scale-[0.98] ${
                      isPortrait
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-8 rounded-xs border-2 flex items-center justify-center text-[10px] font-bold ${
                        isPortrait ? 'border-indigo-600 bg-indigo-100 text-indigo-800' : 'border-slate-300 bg-slate-50 text-slate-500'
                      }`}>
                        ↕
                      </div>
                      <div>
                        <span className="block text-xs sm:text-sm font-bold">Portrait</span>
                        <span className="text-[10px] sm:text-xs text-slate-500">Vertical (Standard)</span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrientation('LANDSCAPE')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition active:scale-[0.98] ${
                      !isPortrait
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-6 rounded-xs border-2 flex items-center justify-center text-[10px] font-bold ${
                        !isPortrait ? 'border-indigo-600 bg-indigo-100 text-indigo-800' : 'border-slate-300 bg-slate-50 text-slate-500'
                      }`}>
                        ↔
                      </div>
                      <div>
                        <span className="block text-xs sm:text-sm font-bold">Landscape</span>
                        <span className="text-[10px] sm:text-xs text-slate-500">Horizontal (Wide)</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sides (Duplex) - Standard Docs Only */}
              {uploadMode === 'SINGLE' && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-1.5">Print Sides</span>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setIsDuplex(false)}
                      className={`p-3 rounded-2xl border text-center text-xs sm:text-sm font-bold transition active:scale-[0.98] ${
                        !isDuplex
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-600/20'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      Single-Sided (1 side)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDuplex(true)}
                      className={`p-3 rounded-2xl border text-center text-xs sm:text-sm font-bold transition active:scale-[0.98] ${
                        isDuplex
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-600/20'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      Both Sides (Duplex)
                    </button>
                  </div>
                </div>
              )}

              {/* Number of Copies - Mobile Big Tap Target */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-600">Number of Sets / Copies</span>
                  <span className="text-xs font-bold text-indigo-600">{copies} {copies === 1 ? 'copy' : 'copies'}</span>
                </div>
                <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50 p-1.5 max-w-[220px]">
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="h-11 w-11 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-slate-800 text-lg active:bg-slate-100 transition"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-black text-slate-900 text-base">
                    {copies}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCopies(copies + 1)}
                    className="h-11 w-11 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-slate-800 text-lg active:bg-slate-100 transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Paper Format Selection */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Paper Format
                  </span>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/50">
                    Selected: {paperSize}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'A4', label: 'A4 Standard', desc: '210 × 297 mm', badge: 'Standard' },
                    { id: 'LEGAL', label: 'Legal / Stamp', desc: '216 × 356 mm', badge: 'Stamp Deed' },
                    { id: 'A3', label: 'A3 Jumbo', desc: '297 × 420 mm', badge: 'Charts' },
                    { id: 'A5', label: 'A5 Booklet', desc: '148 × 210 mm', badge: 'Vouchers' },
                    { id: 'PHOTO_4X6', label: '4×6 Photo', desc: '100 × 150 mm', badge: 'Glossy Photo' },
                    { id: 'LETTER', label: 'Letterhead', desc: '216 × 279 mm', badge: 'Official' },
                    { id: 'B5', label: 'B5 Book', desc: '176 × 250 mm', badge: 'Question Papers' },
                  ].map((p) => {
                    const mult = (shop.pricing?.paperSizeMultipliers as any)?.[p.id] || 1.0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPaperSize(p.id as PaperSize)}
                        className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] ${
                          paperSize === p.id
                            ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 font-bold ring-2 ring-indigo-600/20 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold block leading-tight">{p.label}</span>
                          {mult !== 1.0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                              {mult}x
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{p.desc}</span>
                        <span className="text-[9px] font-semibold text-indigo-600 block mt-1 truncate">
                          {p.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Page Range Selection */}
              {uploadMode === 'SINGLE' && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Pages to Print</span>
                    {pageSelectionType === 'custom' && parsedCustomPages.length > 0 && (
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        {parsedCustomPages.length} Pages
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`p-3 rounded-2xl border text-center text-xs font-bold cursor-pointer transition active:scale-[0.98] ${
                      pageSelectionType === 'all'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="pageSelection"
                        checked={pageSelectionType === 'all'}
                        onChange={() => {
                          setPageSelectionType('all');
                          setPreviewPageIndex(0);
                        }}
                        className="sr-only"
                      />
                      All {pageCount} Pages
                    </label>

                    <label className={`p-3 rounded-2xl border text-center text-xs font-bold cursor-pointer transition active:scale-[0.98] ${
                      pageSelectionType === 'custom'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="pageSelection"
                        checked={pageSelectionType === 'custom'}
                        onChange={() => {
                          setPageSelectionType('custom');
                          setPreviewPageIndex(0);
                        }}
                        className="sr-only"
                      />
                      Custom Range (1-3, 5, 8)
                    </label>
                  </div>

                  {pageSelectionType === 'custom' && (
                    <div className="mt-2.5 space-y-1.5">
                      <input
                        type="text"
                        placeholder="e.g. 1-3, 5, 8"
                        value={customPageRange}
                        onChange={(e) => {
                          setCustomPageRange(e.target.value);
                          setPreviewPageIndex(0);
                        }}
                        className="w-full h-12 rounded-2xl border-2 border-slate-200 px-3.5 text-base text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
                      />
                      
                      {customPageRange.trim() ? (
                        parsedCustomPages.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Printing {parsedCustomPages.length} Pages:
                            </span>
                            <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {parsedCustomPages.join(', ')}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-600 font-medium">
                            Use numbers and hyphens separated by comma, e.g. 1-3, 5, 8
                          </p>
                        )
                      ) : (
                        <p className="text-[11px] text-slate-400">
                          Enter pages like <span className="font-mono font-bold text-slate-600">1-3, 5, 8</span> to print selected sheets only.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Phone Input for Token */}
            <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Your Mobile Number (for pickup token SMS)
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full h-12 rounded-2xl border-2 border-slate-200 px-3.5 text-base font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Summary & Checkout Bar - iPhone / Android Safe Area Optimized */}
      {!activeOrder && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_25px_rgba(0,0,0,0.1)]">
          <div className="mx-auto max-w-3xl flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-tight">
                Total Price ({pricingSummary.sheetsCount} sheets × {copies})
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                ₹{pricingSummary.grandTotalRupees.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              disabled={!file || isParsingPdf || isUploading}
              onClick={() => setIsCheckingOut(true)}
              className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-lg transition-all active:scale-95 ${
                file && !isParsingPdf && !isUploading
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
                  : 'bg-slate-300 cursor-not-allowed shadow-none'
              }`}
            >
              <span>Pay & Print</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Instant Checkout & Real UPI Modal - Mobile Bottom Sheet Style */}
      {isCheckingOut && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">UPI Payment</h3>
                <p className="text-xs text-slate-500">Pay directly to {shop.name}</p>
              </div>
              <button
                onClick={() => setIsCheckingOut(false)}
                className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm hover:bg-slate-200 active:scale-95"
              >
                ✕
              </button>
            </div>

            {/* Dynamic UPI Payment Card */}
            <div className="rounded-2xl bg-gradient-to-b from-indigo-50 to-white border border-indigo-100 p-4 text-center space-y-3">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                Total to Pay
              </span>
              <div className="text-3xl font-black text-slate-900">
                ₹{pricingSummary.grandTotalRupees.toFixed(2)}
              </div>

              {/* Dynamic QR Code */}
              <div className="mx-auto w-44 h-44 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                <img
                  src={upiQrImageUrl}
                  alt="UPI QR Code"
                  className="h-32 w-32 object-contain"
                />
                <span className="text-[10px] font-bold text-slate-600 mt-1 truncate max-w-[150px]">
                  UPI: {shop.upiId}
                </span>
              </div>

              {/* Privacy Reassurance */}
              <p className="text-center text-[11px] text-emerald-700 font-bold flex items-center justify-center gap-1.5 pt-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>100% Private: Document is instantly deleted after printing</span>
              </p>

              {/* Mobile Deep Link button - 1-tap pay on phone */}
              <div className="pt-1">
                <a
                  href={upiPayLink}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-white px-4 py-3.5 text-sm font-bold shadow-md hover:bg-indigo-700 active:scale-95 transition"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Tap to Pay with GPay / PhonePe / Paytm</span>
                </a>
              </div>
            </div>

            {/* Optional UTR Input to verify payment */}
            <div className="text-left bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">UPI Ref / UTR No. (Optional)</span>
                <span className="text-[10px] text-slate-400 font-normal">from UPI App receipt</span>
              </div>
              <input
                type="text"
                placeholder="e.g. 423812345678 (12-digit UTR)"
                value={upiUtr}
                onChange={(e) => setUpiUtr(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-500 leading-tight">
                Shopkeeper checks transaction soundbox or UTR number before handing over prints.
              </p>
            </div>

            {/* Confirmation & Cash Buttons */}
            <div className="space-y-2 pt-1 pb-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => handlePlaceOrder('UPI')}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition active:scale-95 disabled:opacity-60"
              >
                {isUploading ? (
                  <span>Uploading File ({uploadProgress}%)...</span>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm UPI Payment Done</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={() => handlePlaceOrder('CASH')}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-700 active:bg-slate-100 transition disabled:opacity-60 shadow-2xs"
              >
                <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                <span>Pay Cash at Counter (Shopkeeper will click Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
