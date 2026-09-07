'use client';

import React, { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Upload, FileText, CheckCircle2, Clock, AlertCircle, 
  Layers, Palette, Copy, FileCheck, ArrowRight, ShieldCheck, 
  Sparkles, RefreshCw, QrCode, MapPin, IndianRupee, Printer, ExternalLink,
  Eye, RotateCw, CreditCard, BookOpen, ChevronLeft, ChevronRight, ScrollText, Smartphone, User,
  LayoutGrid, Sliders, Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  getShopBySlugFromCloud, createOrderInCloud, subscribeToSingleOrderRealtime, 
  uploadDocumentToStorage, subscribeToShopOrdersRealtime 
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

  // Primary / Front File States (Supports Multiple Files)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [filePageCounts, setFilePageCounts] = useState<number[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<'pdf' | 'image' | 'other'>('other');

  // Customer Pickup Identification
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

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

  // Multi-up Layout & Paper Fitting States
  const [pagesPerSheet, setPagesPerSheet] = useState<1 | 2 | 4 | 6>(1);
  const [paperFitting, setPaperFitting] = useState<'FIT' | 'FILL' | 'CUSTOM'>('FIT');
  const [printScale, setPrintScale] = useState<number>(100);
  const [previewSheetIndex, setPreviewSheetIndex] = useState<number>(0);

  // Payment & Order Placement States
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [shopQueueOrders, setShopQueueOrders] = useState<Order[]>([]);
  const [copiedUpi, setCopiedUpi] = useState(false);

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

  // Real-time queue listener to calculate live queue position
  useEffect(() => {
    if (!shop?.id) return;
    const unsubscribe = subscribeToShopOrdersRealtime(shop.id, (allOrders) => {
      const activeQueue = allOrders.filter(o => o.printStatus === 'QUEUED' || o.printStatus === 'PRINTING');
      setShopQueueOrders(activeQueue);
    });
    return () => unsubscribe();
  }, [shop?.id]);

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

  // Handle Multiple File Selection (Single mode now supports selecting multiple files)
  const handleMultipleFilesSelection = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (!incoming.length) return;

    setSelectedFiles(incoming);
    setActiveFileIndex(0);

    const primary = incoming[0];
    setFile(primary);
    setFileName(incoming.length === 1 ? primary.name : `${incoming.length} Files (${primary.name} + ${incoming.length - 1} more)`);

    const totalBytes = incoming.reduce((acc, f) => acc + f.size, 0);
    setFileSizeStr((totalBytes / (1024 * 1024)).toFixed(2) + ' MB');

    // Revoke old previews
    filePreviews.forEach(p => URL.revokeObjectURL(p));
    const newPreviews = incoming.map(f => URL.createObjectURL(f));
    setFilePreviews(newPreviews);
    setPreviewUrl(newPreviews[0]);

    const isPdf = primary.type === 'application/pdf' || primary.name.toLowerCase().endsWith('.pdf');
    const isImg = primary.type.startsWith('image/');
    setPreviewFileType(isPdf ? 'pdf' : isImg ? 'image' : 'other');

    setIsParsingPdf(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const counts: number[] = [];
      for (const f of incoming) {
        if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
          try {
            const buffer = await f.arrayBuffer();
            const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
            counts.push(Math.max(1, doc.getPageCount()));
          } catch {
            counts.push(1);
          }
        } else {
          counts.push(1);
        }
      }
      setFilePageCounts(counts);
      const total = counts.reduce((a, b) => a + b, 0);
      setPageCount(total);
    } catch (err) {
      console.warn('Page count error:', err);
      setFilePageCounts(incoming.map(() => 1));
      setPageCount(incoming.length);
    } finally {
      setIsParsingPdf(false);
    }

    if (incoming.length > 1) {
      setPageSelectionType('all');
    }
    setPreviewPageIndex(0);
    setPreviewSheetIndex(0);
  };

  const handleSwitchActiveFile = (index: number) => {
    if (!selectedFiles[index]) return;
    setActiveFileIndex(index);
    const targetFile = selectedFiles[index];
    setFile(targetFile);
    if (filePreviews[index]) {
      setPreviewUrl(filePreviews[index]);
    }
    const isPdf = targetFile.type === 'application/pdf' || targetFile.name.toLowerCase().endsWith('.pdf');
    const isImg = targetFile.type.startsWith('image/');
    setPreviewFileType(isPdf ? 'pdf' : isImg ? 'image' : 'other');
    setPreviewPageIndex(0);
  };

  const handleFileSelection = (selectedFile: File) => {
    handleMultipleFilesSelection([selectedFile]);
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
    // If multiple files are chosen, sheets required = ceil(files / pagesPerSheet)
    if (selectedFiles.length > 1) {
      return Math.max(1, Math.ceil(selectedFiles.length / pagesPerSheet));
    }
    if (pageSelectionType === 'custom' && customPageRange.trim()) {
      return parsedCustomPages.length > 0 ? parsedCustomPages.length : pageCount;
    }
    return pageCount;
  })();

  const totalSheets = uploadMode === 'ID_DOUBLE_SIDED'
    ? (idLayoutMode === 'SAME_SIDE' ? 1 : 2)
    : selectedFiles.length > 1
    ? Math.max(1, Math.ceil(selectedFiles.length / pagesPerSheet))
    : (pageSelectionType === 'custom' && parsedCustomPages.length > 0 ? parsedCustomPages.length : pageCount);

  const sheetsSaved = selectedFiles.length > 1 ? Math.max(0, selectedFiles.length - effectivePageCount) : 0;

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
    if (!file && (!selectedFiles || selectedFiles.length === 0)) return;
    setIsUploading(true);

    try {
      let fileDownloadUrl = '';
      let uploadedPublicId = '';
      let backFileDownloadUrl = '';
      let backUploadedPublicId = '';

      // Prepare file to upload (synthesize into standard printable PDF with exact layout, paper size & orientation)
      let primaryUploadFile = file || selectedFiles[0];
      try {
        setUploadProgress(15);
        const { PDFDocument } = await import('pdf-lib');
        const mergedPdf = await PDFDocument.create();

        // Standard paper sizes in points (72 points / inch; 1 mm = 72 / 25.4 pt ≈ 2.83465 pt)
        const paperDimensionsPt: Record<PaperSize, { width: number; height: number }> = {
          A4: { width: 595.28, height: 841.89 },
          LEGAL: { width: 612.28, height: 1009.13 },
          A3: { width: 841.89, height: 1190.55 },
          A5: { width: 419.53, height: 595.28 },
          PHOTO_4X6: { width: 283.46, height: 425.20 },
          LETTER: { width: 612.28, height: 790.87 },
          B5: { width: 498.90, height: 708.66 },
        };

        const baseDim = paperDimensionsPt[paperSize] || paperDimensionsPt.A4;
        const sheetWidth = orientation === 'PORTRAIT' ? baseDim.width : baseDim.height;
        const sheetHeight = orientation === 'PORTRAIT' ? baseDim.height : baseDim.width;

        const embedImageSafe = async (f: File) => {
          const buffer = await f.arrayBuffer();
          if (f.type === 'image/jpeg' || f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg')) {
            return await mergedPdf.embedJpg(buffer);
          } else {
            return await mergedPdf.embedPng(buffer);
          }
        };

        if (uploadMode === 'ID_DOUBLE_SIDED' && file && backFile) {
          // ID Card / Passbook 2-Sided Synthesis
          const frontImg = file.type.startsWith('image/') ? await embedImageSafe(file) : null;
          const backImg = backFile.type.startsWith('image/') ? await embedImageSafe(backFile) : null;

          if (idLayoutMode === 'SAME_SIDE') {
            // Front & Back on top and bottom halves of a single sheet
            const sheet = mergedPdf.addPage([sheetWidth, sheetHeight]);
            const halfH = sheetHeight / 2;
            const cardMaxW = Math.min(sheetWidth * 0.75, 340);
            const cardMaxH = Math.min(halfH * 0.75, 215);

            if (frontImg) {
              const s = Math.min(cardMaxW / frontImg.width, cardMaxH / frontImg.height);
              const w = frontImg.width * s;
              const h = frontImg.height * s;
              sheet.drawImage(frontImg, { x: (sheetWidth - w) / 2, y: halfH + (halfH - h) / 2, width: w, height: h });
            }
            if (backImg) {
              const s = Math.min(cardMaxW / backImg.width, cardMaxH / backImg.height);
              const w = backImg.width * s;
              const h = backImg.height * s;
              sheet.drawImage(backImg, { x: (sheetWidth - w) / 2, y: (halfH - h) / 2, width: w, height: h });
            }
          } else {
            // DUPLEX: Front on Page 1, Back on Page 2
            const cardMaxW = Math.min(sheetWidth * 0.8, 380);
            const cardMaxH = Math.min(sheetHeight * 0.8, 240);

            const page1 = mergedPdf.addPage([sheetWidth, sheetHeight]);
            if (frontImg) {
              const s = Math.min(cardMaxW / frontImg.width, cardMaxH / frontImg.height);
              const w = frontImg.width * s;
              const h = frontImg.height * s;
              page1.drawImage(frontImg, { x: (sheetWidth - w) / 2, y: (sheetHeight - h) / 2, width: w, height: h });
            }

            const page2 = mergedPdf.addPage([sheetWidth, sheetHeight]);
            if (backImg) {
              const s = Math.min(cardMaxW / backImg.width, cardMaxH / backImg.height);
              const w = backImg.width * s;
              const h = backImg.height * s;
              page2.drawImage(backImg, { x: (sheetWidth - w) / 2, y: (sheetHeight - h) / 2, width: w, height: h });
            }
          }

          const mergedBytes = await mergedPdf.save();
          primaryUploadFile = new File([mergedBytes as any], `ID_Card_${idLayoutMode}.pdf`, { type: 'application/pdf' });

        } else if (uploadMode === 'SINGLE' && selectedFiles.length > 1) {
          if (pagesPerSheet === 1) {
            // 1-on-1: Append each file as a full sheet
            for (const f of selectedFiles) {
              if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
                const buffer = await f.arrayBuffer();
                const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
                const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
                copiedPages.forEach(p => mergedPdf.addPage(p));
              } else if (f.type.startsWith('image/')) {
                const img = await embedImageSafe(f);
                const page = mergedPdf.addPage([sheetWidth, sheetHeight]);
                const margin = 18;
                const availW = sheetWidth - (margin * 2);
                const availH = sheetHeight - (margin * 2);
                const s = (paperFitting === 'FILL'
                  ? Math.max(availW / img.width, availH / img.height)
                  : Math.min(availW / img.width, availH / img.height)) * (paperFitting === 'CUSTOM' ? printScale / 100 : 1);
                const drawW = img.width * s;
                const drawH = img.height * s;
                const drawX = margin + (availW - drawW) / 2;
                const drawY = margin + (availH - drawH) / 2;
                page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
              }
            }
          } else {
            // Multi-up grid layout (2, 4, 6 per sheet)
            const cols = pagesPerSheet === 2 
              ? (orientation === 'LANDSCAPE' ? 2 : 1) 
              : pagesPerSheet === 4 
              ? 2 
              : (orientation === 'LANDSCAPE' ? 3 : 2);
            const rows = pagesPerSheet === 2 
              ? (orientation === 'LANDSCAPE' ? 1 : 2) 
              : pagesPerSheet === 4 
              ? 2 
              : (orientation === 'LANDSCAPE' ? 2 : 3);

            const margin = 18;
            const gap = 12;
            const totalGapX = gap * (cols - 1);
            const totalGapY = gap * (rows - 1);
            const slotW = (sheetWidth - (margin * 2) - totalGapX) / cols;
            const slotH = (sheetHeight - (margin * 2) - totalGapY) / rows;

            for (let i = 0; i < selectedFiles.length; i += pagesPerSheet) {
              const chunk = selectedFiles.slice(i, i + pagesPerSheet);
              const sheetPage = mergedPdf.addPage([sheetWidth, sheetHeight]);

              for (let cIdx = 0; cIdx < chunk.length; cIdx++) {
                const f = chunk[cIdx];
                const col = cIdx % cols;
                const row = Math.floor(cIdx / cols);

                // Bottom-left origin in PDF:
                const slotX = margin + col * (slotW + gap);
                const slotY = sheetHeight - margin - ((row + 1) * slotH) - (row * gap);

                try {
                  if (f.type.startsWith('image/')) {
                    const img = await embedImageSafe(f);
                    const s = (paperFitting === 'FILL'
                      ? Math.max(slotW / img.width, slotH / img.height)
                      : Math.min(slotW / img.width, slotH / img.height)) * (paperFitting === 'CUSTOM' ? printScale / 100 : 1);
                    const drawW = img.width * s;
                    const drawH = img.height * s;
                    const drawX = slotX + (slotW - drawW) / 2;
                    const drawY = slotY + (slotH - drawH) / 2;
                    sheetPage.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
                  } else if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
                    const buffer = await f.arrayBuffer();
                    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
                    if (doc.getPageCount() > 0) {
                      const embeddedPage = await mergedPdf.embedPage(doc.getPages()[0]);
                      const s = Math.min(slotW / embeddedPage.width, slotH / embeddedPage.height) * (paperFitting === 'CUSTOM' ? printScale / 100 : 1);
                      const drawW = embeddedPage.width * s;
                      const drawH = embeddedPage.height * s;
                      const drawX = slotX + (slotW - drawW) / 2;
                      const drawY = slotY + (slotH - drawH) / 2;
                      sheetPage.drawPage(embeddedPage, { x: drawX, y: drawY, width: drawW, height: drawH });
                    }
                  }
                } catch (slotErr) {
                  console.warn('Error placing file in multi-up slot:', f.name, slotErr);
                }
              }
            }
          }

          const mergedBytes = await mergedPdf.save();
          primaryUploadFile = new File([mergedBytes as any], `Combined_${selectedFiles.length}_Files_${pagesPerSheet}Up.pdf`, { type: 'application/pdf' });
        } else if (uploadMode === 'SINGLE' && selectedFiles.length === 1) {
          const singleF = selectedFiles[0];
          if (singleF.type.startsWith('image/')) {
            // Embed single image cleanly into paper-sized PDF
            const img = await embedImageSafe(singleF);
            const page = mergedPdf.addPage([sheetWidth, sheetHeight]);
            const margin = 18;
            const availW = sheetWidth - (margin * 2);
            const availH = sheetHeight - (margin * 2);
            const s = (paperFitting === 'FILL'
              ? Math.max(availW / img.width, availH / img.height)
              : Math.min(availW / img.width, availH / img.height)) * (paperFitting === 'CUSTOM' ? printScale / 100 : 1);
            const drawW = img.width * s;
            const drawH = img.height * s;
            const drawX = margin + (availW - drawW) / 2;
            const drawY = margin + (availH - drawH) / 2;
            page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
            const mergedBytes = await mergedPdf.save();
            primaryUploadFile = new File([mergedBytes as any], `${singleF.name.replace(/\.[^/.]+$/, '')}_Print.pdf`, { type: 'application/pdf' });
          } else if ((singleF.type === 'application/pdf' || singleF.name.toLowerCase().endsWith('.pdf')) && pageSelectionType === 'custom' && customPageRange.trim()) {
            // Trim single PDF to custom selected pages
            const buffer = await singleF.arrayBuffer();
            const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
            const totalP = doc.getPageCount();
            const chosen = parsePageRange(customPageRange, totalP);
            const zeroIndexed = chosen.map(p => p - 1).filter(idx => idx >= 0 && idx < totalP);
            if (zeroIndexed.length > 0) {
              const copiedPages = await mergedPdf.copyPages(doc, zeroIndexed);
              copiedPages.forEach(p => mergedPdf.addPage(p));
              const mergedBytes = await mergedPdf.save();
              primaryUploadFile = new File([mergedBytes as any], `${singleF.name.replace(/\.[^/.]+$/, '')}_Pages_${customPageRange.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`, { type: 'application/pdf' });
            }
          }
        }
      } catch (mergeErr) {
        console.warn('PDF synthesis notice:', mergeErr);
        primaryUploadFile = file || selectedFiles[0];
      }

      // 1. Upload Front / Primary Document
      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', primaryUploadFile);
        uploadFormData.append('shopId', shop.id);
        uploadFormData.append('orderId', 'ord_' + Date.now());

        setUploadProgress(40);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          fileDownloadUrl = uploadData.fileUrl;
          uploadedPublicId = uploadData.publicId || '';
        } else {
          fileDownloadUrl = await uploadDocumentToStorage(primaryUploadFile, shop.id, (percent) => {
            setUploadProgress(percent);
          });
        }
      } catch (err) {
        console.warn('Front file upload fallback:', err);
        fileDownloadUrl = URL.createObjectURL(primaryUploadFile);
      }

      // 2. Upload Back File (if in ID mode)
      if (uploadMode === 'ID_DOUBLE_SIDED' && backFile) {
        try {
          const backFormData = new FormData();
          backFormData.append('file', backFile);
          backFormData.append('shopId', shop.id);
          backFormData.append('orderId', 'ord_back_' + Date.now());

          setUploadProgress(70);
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

      const finalFileName = uploadMode === 'ID_DOUBLE_SIDED' && backFile
        ? `${file?.name || 'Front'} + ${backFile.name}`
        : selectedFiles.length > 1
        ? `${selectedFiles.length} Files (${selectedFiles[0].name} + ${selectedFiles.length - 1} more)`
        : (file?.name || 'Document.pdf');

      // 4. Save Order in Cloud Firestore
      const orderPayload: any = {
        tokenNumber,
        shopId: shop.id,
        shopSlug: shop.slug,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || '9876543210',
        uploadMode,
        fileName: finalFileName,
        fileSizeBytes: primaryUploadFile.size + (backFile ? backFile.size : 0),
        fileUrl: fileDownloadUrl,
        pageCount: uploadMode === 'ID_DOUBLE_SIDED' ? (idLayoutMode === 'SAME_SIDE' ? 1 : 2) : pageCount,
        selectedPages: uploadMode === 'ID_DOUBLE_SIDED' 
          ? (idLayoutMode === 'SAME_SIDE' ? 'ID_SAME_SIDE' : 'ID_DUPLEX')
          : (selectedFiles.length > 1 ? 'ALL' : pageSelectionType === 'all' ? 'ALL' : customPageRange),
        effectivePageCount,
        colorMode,
        isDuplex: effectiveDuplex,
        paperSize,
        orientation,
        pagesPerSheet,
        paperFitting,
        printScale,
        copies,
        additionalServices: [],
        totalAmountPaise: pricingSummary.grandTotalPaise,
        paymentStatus: paymentType === 'UPI' ? 'PENDING' : 'CASH_AT_COUNTER',
        paymentId: paymentType === 'UPI' ? `UPI_${Date.now()}` : `CASH_${Date.now()}`,
        printStatus: 'QUEUED',
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

  const cleanUpiId = (shop.upiId || '9876543210@paytm').trim();
  const cleanShopName = (shop.name || 'Print Shop').trim();
  const formattedGrandTotal = pricingSummary.grandTotalRupees.toFixed(2);
  const upiPayLink = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanShopName)}&am=${formattedGrandTotal}&cu=INR&tn=${encodeURIComponent(`Token_${shop.slug}`)}`;

  const handleCopyUpi = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cleanUpiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleInitiateCheckout = () => {
    if (!customerName.trim()) {
      alert('Please enter your name below so the shopkeeper can hand you your prints.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 10) {
      alert('Please enter a valid 10-digit mobile number for order pickup.');
      return;
    }
    setIsCheckingOut(true);
  };

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
          /* Active Order Tracking Screen with Real-Time Queue Position & Token */
          <div className="space-y-4 sm:space-y-6">
            {(() => {
              const activeQueueIndex = shopQueueOrders.findIndex(o => o.id === activeOrder.id);
              const queuePosition = activeQueueIndex >= 0 ? activeQueueIndex + 1 : 1;
              const isCurrentlyPrinting = activeOrder.printStatus === 'PRINTING';
              const isPrinted = activeOrder.printStatus === 'PRINTED';

              return (
                <div className="rounded-3xl bg-white p-5 sm:p-8 shadow-sm border border-slate-200 text-center space-y-4">
                  <div className={`inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border ${
                    isPrinted 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                      : isCurrentlyPrinting 
                      ? 'bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse'
                      : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {isPrinted ? (
                      <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" />
                    ) : isCurrentlyPrinting ? (
                      <Printer className="h-7 w-7 sm:h-8 sm:w-8 animate-bounce" />
                    ) : (
                      <Clock className="h-7 w-7 sm:h-8 sm:w-8 animate-pulse" />
                    )}
                  </div>

                  {/* Status Pill */}
                  <div>
                    <span className={`text-[11px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full border ${
                      isPrinted
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : isCurrentlyPrinting
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 animate-pulse'
                        : activeOrder.paymentStatus === 'PENDING'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                        : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                    }`}>
                      {isPrinted
                        ? '✓ Document Printed & Ready for Pickup'
                        : isCurrentlyPrinting
                        ? '⚡ Payment Accepted — Printing in Progress...'
                        : activeOrder.paymentStatus === 'PENDING'
                        ? '⏳ Waiting for Shopkeeper to Verify Payment & Accept'
                        : '💵 Pay Cash at Counter — Shopkeeper will Accept & Print'}
                    </span>
                  </div>

                  {/* Token Number & Queue Position Card */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-indigo-50/60 to-white border-2 border-indigo-100 shadow-sm text-center space-y-2.5">
                    <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest block">
                      YOUR OFFICIAL PICKUP TOKEN
                    </span>
                    <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
                      TOKEN #{activeOrder.tokenNumber}
                    </h2>
                    
                    {/* Live Queue Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold">
                      <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>
                        {isPrinted
                          ? 'Completed • Ready at Counter'
                          : isCurrentlyPrinting
                          ? 'Printing Now!'
                          : queuePosition === 1
                          ? 'Next in Line (#1 in Queue)'
                          : `Queue Position: #${queuePosition} in line`}
                      </span>
                    </div>

                    {/* Live Verification Notice */}
                    <div className="p-3 rounded-2xl bg-white/95 border border-indigo-100 text-xs text-slate-700 text-center space-y-1">
                      {isPrinted ? (
                        <p className="font-bold text-emerald-700">
                          🎉 Your document is printed! Please collect it from the counter.
                        </p>
                      ) : isCurrentlyPrinting ? (
                        <p className="font-bold text-indigo-700 animate-pulse">
                          ⚡ Shopkeeper verified payment and accepted your order! Printing now on the counter printer.
                        </p>
                      ) : activeOrder.paymentStatus === 'PENDING' ? (
                        <div className="space-y-1">
                          <p className="font-bold text-amber-900">
                            📢 UPI Payment Submitted (₹{(activeOrder.totalAmountPaise / 100).toFixed(2)})
                          </p>
                          <p className="text-[11px] text-slate-600">
                            The shopkeeper is checking their UPI soundbox / app. Your print will start automatically once accepted!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900">
                            💵 Cash Payment at Counter: ₹{(activeOrder.totalAmountPaise / 100).toFixed(2)}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            Please show <strong>Token #{activeOrder.tokenNumber}</strong> and pay cash. The shopkeeper will accept and print immediately.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-xs text-slate-600 flex items-center justify-center gap-2 flex-wrap">
                      <span>Customer: <strong className="text-slate-900">{activeOrder.customerName || 'Customer'}</strong></span>
                      <span>•</span>
                      <span>Mobile: <strong className="text-slate-900">{activeOrder.customerPhone}</strong></span>
                    </div>
                  </div>

                  {/* Mobile 3-Step Flow */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-2 border-t border-slate-100">
                    <div className={`text-center p-2 sm:p-2.5 rounded-xl border ${
                      activeOrder.paymentStatus === 'PAID' || activeOrder.paymentStatus === 'PENDING'
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <span className="text-[9px] font-bold text-slate-500 block">STEP 1</span>
                      <span className={`text-[11px] font-bold leading-tight block mt-0.5 ${
                        activeOrder.paymentStatus === 'CASH_AT_COUNTER' ? 'text-amber-800' : 'text-emerald-800'
                      }`}>
                        {activeOrder.paymentStatus === 'CASH_AT_COUNTER' ? 'Pay Cash' : 'UPI Sent'}
                      </span>
                    </div>
                    <div className={`text-center p-2 sm:p-2.5 rounded-xl border ${
                      isCurrentlyPrinting 
                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400/20' 
                        : isPrinted 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-amber-50 border-amber-300 animate-pulse'
                    }`}>
                      <span className="text-[9px] font-bold text-slate-500 block">STEP 2</span>
                      <span className={`text-[11px] font-bold leading-tight block mt-0.5 ${
                        isCurrentlyPrinting ? 'text-indigo-800 font-black' : isPrinted ? 'text-emerald-800 font-bold' : 'text-amber-800 font-bold'
                      }`}>
                        {isCurrentlyPrinting ? 'Printing...' : isPrinted ? 'Printed' : 'Shop Approval'}
                      </span>
                    </div>
                    <div className={`text-center p-2 sm:p-2.5 rounded-xl border ${
                      isPrinted 
                        ? 'bg-emerald-100 border-emerald-300 font-bold text-emerald-900' 
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      <span className="text-[9px] font-bold block">STEP 3</span>
                      <span className="text-[11px] font-bold leading-tight block mt-0.5">Ready for Pickup</span>
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
                        filePreviews.forEach(p => URL.revokeObjectURL(p));
                        setPreviewUrl(null);
                        setBackPreviewUrl(null);
                        setFile(null);
                        setSelectedFiles([]);
                        setFilePreviews([]);
                        setFilePageCounts([]);
                        setBackFile(null);
                        setActiveOrder(null);
                      }}
                      className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white active:bg-slate-800 transition"
                    >
                      Print Another Document
                    </button>
                  </div>
                </div>
              );
            })()}
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

              {/* Mode Tabs: Select File(s) vs ID Card / Passbook */}
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
                    <span className="block text-sm sm:text-base font-black text-slate-900 leading-tight">Select File(s)</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-none block mt-0.5">PDFs, Photos, Documents</span>
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
                /* SINGLE & MULTI-DOCUMENT UPLOAD */
                <div className="pt-1 space-y-2.5">
                  {!file ? (
                    <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl p-6 sm:p-8 text-center bg-indigo-50/20 active:bg-indigo-50/40 transition cursor-pointer group">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,image/*,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleMultipleFilesSelection(e.target.files);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      />
                      <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 group-hover:scale-110 transition-transform">
                        <Upload className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <p className="mt-2.5 text-sm font-bold text-slate-800">
                        Tap here to select file(s) from mobile
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Select 1 or multiple PDFs, Photos, Documents (up to 50 MB)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                        <div className="flex items-center gap-3 truncate min-w-0">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            {selectedFiles.length > 1 ? `${selectedFiles.length}F` : previewFileType === 'pdf' ? 'PDF' : previewFileType === 'image' ? 'IMG' : 'DOC'}
                          </div>
                          <div className="truncate min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {selectedFiles.length > 1 
                                ? `${selectedFiles.length} Files Selected (File ${activeFileIndex + 1}: ${selectedFiles[activeFileIndex]?.name})`
                                : fileName}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>{fileSizeStr}</span>
                              <span>•</span>
                              {isParsingPdf ? (
                                <span className="text-amber-600 font-semibold animate-pulse">Counting pages...</span>
                              ) : (
                                <span className="font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded text-[10px]">
                                  {pageCount} {pageCount === 1 ? 'Page' : 'Pages'} total
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (previewUrl) URL.revokeObjectURL(previewUrl);
                            filePreviews.forEach(p => URL.revokeObjectURL(p));
                            setFilePreviews([]);
                            setSelectedFiles([]);
                            setFilePageCounts([]);
                            setPreviewUrl(null);
                            setFile(null);
                          }}
                          className="text-xs font-bold text-rose-600 active:text-rose-700 px-3 py-2 shrink-0 rounded-xl bg-white border border-rose-200 shadow-xs"
                        >
                          Change
                        </button>
                      </div>

                      {/* Multi-file interactive switcher chips */}
                      {selectedFiles.length > 1 && (
                        <div className="p-2.5 rounded-2xl bg-white border border-indigo-100 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                            <span>Tap file to preview below:</span>
                            <span className="font-bold text-indigo-700">{selectedFiles.length} documents</span>
                          </div>
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                            {selectedFiles.map((f, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSwitchActiveFile(idx)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 border ${
                                  activeFileIndex === idx
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <span>{idx + 1}. {f.name.length > 14 ? f.name.substring(0, 11) + '...' : f.name}</span>
                                <span className={`text-[10px] ${activeFileIndex === idx ? 'text-indigo-200 font-semibold' : 'text-slate-400'}`}>
                                  ({filePageCounts[idx] || 1}p)
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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
            {(file || backFile || selectedFiles.length > 0) && (
              <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3">
                {/* Header & Orientation Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Eye className="h-4 w-4 text-indigo-600" />
                        Live Paper Print Preview
                      </span>
                      {selectedFiles.length > 1 && pagesPerSheet > 1 && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {pagesPerSheet}-on-1 Sheet
                        </span>
                      )}
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase">
                        {paperFitting === 'CUSTOM' ? `${printScale}% Scale` : paperFitting === 'FILL' ? 'Fill Sheet' : 'Scale 1:1'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {currentPaperSpec.label} ({displayWidthMm} × {displayHeightMm} mm) • {isPortrait ? 'Portrait ↕' : 'Landscape ↔'}
                      {selectedFiles.length > 1 && ` • Showing Sheet ${previewSheetIndex + 1} of ${totalSheets}`}
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
                <div className="relative rounded-2xl bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200/90 border border-slate-200 p-3 sm:p-6 flex flex-col items-center justify-center min-h-[340px] sm:min-h-[420px] overflow-hidden shadow-inner">
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
                        ? (paperSize === 'LEGAL' ? 'min(240px, 68vw)' : paperSize === 'PHOTO_4X6' ? 'min(200px, 60vw)' : 'min(270px, 74vw)') 
                        : (paperSize === 'A3' ? 'min(460px, 94vw)' : paperSize === 'LEGAL' ? 'min(440px, 92vw)' : 'min(400px, 90vw)'),
                      maxWidth: isPortrait ? '320px' : '520px',
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
                    <div className="w-full h-full relative z-10 flex flex-col items-center justify-center p-2 sm:p-2.5 bg-white overflow-hidden">
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
                      ) : selectedFiles.length > 1 ? (
                        /* MULTI-FILE GRID RENDERING (1-up, 2-up, 4-up, 6-up) */
                        <div className={`w-full h-full p-1.5 ${
                          pagesPerSheet === 1 
                            ? 'flex items-center justify-center'
                            : pagesPerSheet === 2
                            ? (!isPortrait ? 'grid grid-cols-2 gap-2' : 'grid grid-rows-2 gap-2')
                            : pagesPerSheet === 4
                            ? 'grid grid-cols-2 grid-rows-2 gap-1.5'
                            : (!isPortrait ? 'grid grid-cols-3 grid-rows-2 gap-1' : 'grid grid-cols-2 grid-rows-3 gap-1')
                        }`}>
                          {Array.from({ length: pagesPerSheet }).map((_, slotIdx) => {
                            const fileIdx = (previewSheetIndex * pagesPerSheet) + slotIdx;
                            const currentFile = selectedFiles[fileIdx];
                            const currentPreview = filePreviews[fileIdx];
                            const isSlotImg = currentFile && currentFile.type.startsWith('image/');
                            const isSlotPdf = currentFile && (currentFile.type === 'application/pdf' || currentFile.name.toLowerCase().endsWith('.pdf'));

                            if (!currentFile) {
                              return (
                                <div key={slotIdx} className="w-full h-full border border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50/50 p-2 text-slate-300">
                                  <span className="text-[9px] font-semibold italic">Empty Slot</span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={slotIdx}
                                className="w-full h-full border border-indigo-200/80 rounded-lg flex flex-col items-center justify-center relative bg-indigo-50/15 overflow-hidden p-1 shadow-2xs"
                              >
                                <span className="absolute top-1 left-1 bg-slate-900/80 text-white text-[8px] font-bold px-1.5 py-0.2 rounded shadow-xs z-10 truncate max-w-[85%]">
                                  #{fileIdx + 1}: {currentFile.name}
                                </span>

                                {isSlotImg && currentPreview ? (
                                  <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                    <img
                                      src={currentPreview}
                                      alt={currentFile.name}
                                      style={{
                                        transform: paperFitting === 'CUSTOM' ? `scale(${printScale / 100})` : 'scale(1)',
                                        transition: 'transform 0.15s ease'
                                      }}
                                      className={`w-full h-full ${paperFitting === 'FILL' ? 'object-cover' : 'object-contain'} rounded-xs pointer-events-none select-none`}
                                    />
                                  </div>
                                ) : isSlotPdf ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                    <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-500 mb-1" />
                                    <span className="text-[10px] font-bold text-slate-800 line-clamp-1 max-w-[120px]">{currentFile.name}</span>
                                    <span className="text-[8px] text-slate-400 font-semibold mt-0.5">PDF • {filePageCounts[fileIdx] || 1}p</span>
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                    <FileText className="h-6 w-6 text-slate-400 mb-1" />
                                    <span className="text-[10px] font-bold text-slate-700 line-clamp-1 max-w-[120px]">{currentFile.name}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
                              style={{
                                transform: paperFitting === 'CUSTOM' ? `scale(${printScale / 100})` : 'scale(1)',
                                transition: 'transform 0.15s ease'
                              }}
                              className={`w-full h-full ${paperFitting === 'FILL' ? 'object-cover' : 'object-contain'} pointer-events-none select-none rounded-xs`}
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

                  {/* Multi-Sheet Navigator under simulated paper */}
                  {selectedFiles.length > 1 && totalSheets > 1 && (
                    <div className="mt-3 flex items-center justify-between gap-2 w-full max-w-sm px-1">
                      <button
                        type="button"
                        disabled={previewSheetIndex <= 0}
                        onClick={() => setPreviewSheetIndex(prev => Math.max(0, prev - 1))}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-35 disabled:cursor-not-allowed shadow-2xs hover:bg-slate-50 active:scale-95 transition"
                      >
                        ◀ Prev
                      </button>

                      <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar max-w-[170px]">
                        {Array.from({ length: totalSheets }).map((_, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => setPreviewSheetIndex(sIdx)}
                            className={`h-7 min-w-[32px] px-2 rounded-lg text-xs font-bold transition shrink-0 ${
                              previewSheetIndex === sIdx
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {sIdx + 1}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={previewSheetIndex >= totalSheets - 1}
                        onClick={() => setPreviewSheetIndex(prev => Math.min(totalSheets - 1, prev + 1))}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs disabled:opacity-35 disabled:cursor-not-allowed shadow-2xs hover:bg-slate-50 active:scale-95 transition"
                      >
                        Next ▶
                      </button>
                    </div>
                  )}

                  <div className="mt-2.5 text-center">
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                      Simulated Sheet: <strong className="text-slate-800">{currentPaperSpec.label}</strong> ({displayWidthMm} × {displayHeightMm} mm)
                      {selectedFiles.length > 1 && pagesPerSheet > 1 && (
                        <span className="ml-1 text-indigo-600 font-bold">
                          • {pagesPerSheet}-Up Layout
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 1.6 OUTSIDE OF PRINT PREVIEW - BIG MOBILE SCROLL & PAGE CONTROLLER */}
            {uploadMode === 'SINGLE' && selectedFiles.length <= 1 && file && activePagesList.length > 1 && (
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

              {/* Print Layout & Multi-Up Sheet Fitting (Standard & Multi-file) */}
              {uploadMode === 'SINGLE' && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <LayoutGrid className="h-4 w-4 text-indigo-600" />
                        Print Layout (Files per Sheet)
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/50">
                        {pagesPerSheet === 1 ? '1 per Sheet' : `${pagesPerSheet}-on-1 Sheet`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { count: 1 as const, label: '1 on 1 Sheet', desc: 'Full page standard', sub: '1 file/sheet' },
                        { count: 2 as const, label: '2 on 1 Sheet', desc: !isPortrait ? 'Side-by-side ↔' : 'Stacked ↕', sub: '2 files/sheet' },
                        { count: 4 as const, label: '4 on 1 Sheet', desc: '2×2 Grid', sub: '4 files/sheet' },
                        { count: 6 as const, label: '6 on 1 Sheet', desc: !isPortrait ? '3×2 Grid' : '2×3 Grid', sub: '6 files/sheet' },
                      ].map((item) => (
                        <button
                          key={item.count}
                          type="button"
                          onClick={() => {
                            setPagesPerSheet(item.count);
                            setPreviewSheetIndex(0);
                          }}
                          className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] ${
                            pagesPerSheet === item.count
                              ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 font-bold ring-2 ring-indigo-600/20 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold block leading-tight">{item.label}</span>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                              pagesPerSheet === item.count ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {item.count}x
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                          <span className="text-[9px] font-semibold text-indigo-600 block mt-1">
                            {item.sub}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Paper Savings Callout */}
                    {selectedFiles.length > 1 && sheetsSaved > 0 && (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200 mt-2.5">
                        <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Paper & Cost Saving:</strong> {selectedFiles.length} files fitted into {effectivePageCount} {effectivePageCount === 1 ? 'sheet' : 'sheets'}! You save {sheetsSaved} {sheetsSaved === 1 ? 'sheet' : 'sheets'} of paper (₹{((sheetsSaved * shop.pricing.bwSinglePaise) / 100).toFixed(2)} saved).
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Paper Fitting & Sizing Adjustments */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                        Paper Fitting & Sizing
                      </span>
                      <span className="text-[11px] font-bold text-indigo-600">
                        {paperFitting === 'FIT' ? 'Fit to Paper (No Crop)' : paperFitting === 'FILL' ? 'Fill Sheet (Borderless)' : `Scale ${printScale}%`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'FIT' as const, label: 'Fit to Page', desc: 'No crop • Full view' },
                        { id: 'FILL' as const, label: 'Fill Sheet', desc: 'Edge-to-edge' },
                        { id: 'CUSTOM' as const, label: 'Custom Scale', desc: `${printScale}% size` },
                      ].map((fit) => (
                        <button
                          key={fit.id}
                          type="button"
                          onClick={() => setPaperFitting(fit.id)}
                          className={`p-2.5 rounded-2xl border text-center transition active:scale-[0.98] ${
                            paperFitting === fit.id
                              ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 font-bold ring-2 ring-indigo-600/20'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span className="block text-xs font-bold leading-tight">{fit.label}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{fit.desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* Custom Scale Slider & Quick Preset Pills */}
                    {paperFitting === 'CUSTOM' && (
                      <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Adjust Scale Percentage</span>
                          <span className="font-mono font-black text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
                            {printScale}%
                          </span>
                        </div>

                        <input
                          type="range"
                          min="40"
                          max="120"
                          step="5"
                          value={printScale}
                          onChange={(e) => setPrintScale(parseInt(e.target.value, 10))}
                          className="w-full accent-indigo-600 cursor-pointer"
                        />

                        {/* Quick Presets for ID Cards & Small Photos */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Presets:</span>
                          {[
                            { label: '50% (ID/Card)', val: 50 },
                            { label: '75% (Medium)', val: 75 },
                            { label: '100% (Standard)', val: 100 },
                            { label: '115% (Fill)', val: 115 },
                          ].map((p) => (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => setPrintScale(p.val)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                                printScale === p.val
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                  {selectedFiles.length > 1 ? (
                    <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-indigo-950 block">
                          All Pages ({pageCount} Pages Total)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Printing all pages across {selectedFiles.length} combined files. Custom page range is disabled for multi-file batches.
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-200 shrink-0">
                        Combined
                      </span>
                    </div>
                  ) : (
                    <>
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
                          {pageCount > 1 ? `All Pages (${pageCount} Pages)` : 'All Pages'}
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
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Customer Details for Pickup Identification */}
            <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-4 w-4 text-indigo-600" />
                  Your Pickup Details
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Required
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-12 rounded-2xl border-2 border-slate-200 px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full h-12 rounded-2xl border-2 border-slate-200 px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                The shopkeeper will verify your name and token number before handing over your prints.
              </p>
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
                ₹{formattedGrandTotal}
              </span>
            </div>

            <button
              type="button"
              disabled={!file || isParsingPdf || isUploading}
              onClick={handleInitiateCheckout}
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

      {/* Instant Checkout & Direct UPI Modal */}
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

            {/* Direct UPI Payment Card (No QR, Direct 1-Tap Pay) */}
            <div className="rounded-2xl bg-gradient-to-b from-indigo-50 to-white border border-indigo-100 p-4 text-center space-y-3.5">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                Total Amount
              </span>
              <div className="text-3xl sm:text-4xl font-black text-slate-900">
                ₹{formattedGrandTotal}
              </div>

              {/* Mobile 1-Tap UPI Intent Button */}
              <div className="pt-1">
                <a
                  href={upiPayLink}
                  target="_self"
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white px-4 py-4 text-sm sm:text-base font-black shadow-lg shadow-indigo-600/30 hover:opacity-95 active:scale-[0.98] transition text-center"
                >
                  <Smartphone className="h-5 w-5 shrink-0" />
                  <span>Click & Pay ₹{formattedGrandTotal} with Any UPI App</span>
                </a>
              </div>

              {/* Supported UPI Apps Badges */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap text-[10px] font-bold text-slate-600 pt-0.5">
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-2xs">PhonePe</span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-2xs">Google Pay</span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-2xs">Paytm</span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-2xs">BHIM</span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-2xs">Cred</span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-2xs">Any UPI</span>
              </div>

              {/* UPI ID & Copy Option (For Desktop / Direct Transfer) */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 text-left text-xs shadow-2xs">
                <div className="truncate min-w-0 pr-2">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Shop UPI ID:</span>
                  <span className="font-mono font-bold text-slate-800 truncate block">{cleanUpiId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 font-bold text-indigo-700 hover:bg-indigo-100 shrink-0 text-xs active:scale-95 transition"
                >
                  {copiedUpi ? '✓ Copied' : 'Copy ID'}
                </button>
              </div>

              {/* Privacy Reassurance */}
              <p className="text-center text-[11px] text-emerald-700 font-bold flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>100% Private: Document is instantly deleted after printing</span>
              </p>
            </div>

            {/* Step 2 Confirmation Buttons */}
            <div className="space-y-2 pt-1 pb-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => handlePlaceOrder('UPI')}
                className="w-full flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3.5 px-4 text-white shadow-md transition active:scale-95 disabled:opacity-60"
              >
                {isUploading ? (
                  <span className="text-sm font-bold">Uploading File ({uploadProgress}%)...</span>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-sm font-black">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>I Have Paid via UPI — Submit for Verification</span>
                    </div>
                    <span className="text-[10px] text-emerald-100 font-medium">
                      Shopkeeper checks soundbox / UPI app & accepts print
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={() => handlePlaceOrder('CASH')}
                className="w-full flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 py-3 px-4 text-slate-700 active:bg-slate-100 transition disabled:opacity-60 shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <IndianRupee className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span>Pay Cash at Counter</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  Pay ₹{formattedGrandTotal} at the counter • Shopkeeper accepts & prints
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
