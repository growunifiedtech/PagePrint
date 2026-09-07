'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, CheckCircle2, QrCode, ArrowLeft, 
  Download, PrinterCheck, Plus, Trash2, Sliders, ShieldCheck,
  Store, CreditCard, IndianRupee
} from 'lucide-react';
import { updateShopInCloud } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { Shop, PrinterDevice, PaperSize } from '@/types';
import Navbar from '@/components/Navbar';

export default function MerchantSettingsPage() {
  const router = useRouter();
  const { user, shop, setShop, loading } = useAuth();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New printer form state
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterDriver, setNewPrinterDriver] = useState('');
  const [newSupportsColor, setNewSupportsColor] = useState(false);
  const [newSupportsDuplex, setNewSupportsDuplex] = useState(true);
  const [newAssignedTypes, setNewAssignedTypes] = useState<('BW' | 'COLOR' | 'DUPLEX' | 'LEGAL' | 'PHOTO' | 'LARGE_FORMAT')[]>(['BW', 'DUPLEX']);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent"></div>
          <p className="text-sm font-semibold text-slate-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateShopInCloud(shop.id, shop);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePricing = (key: string, value: number) => {
    setShop({
      ...shop,
      pricing: {
        ...shop.pricing,
        [key]: value
      }
    });
  };

  const updatePaperMultiplier = (size: PaperSize, val: number) => {
    setShop({
      ...shop,
      pricing: {
        ...shop.pricing,
        paperSizeMultipliers: {
          ...shop.pricing.paperSizeMultipliers,
          [size]: val
        }
      }
    });
  };

  const handleAddPrinter = () => {
    if (!newPrinterName.trim()) {
      alert('Please enter a printer name (e.g. Canon imageRUNNER or Epson L3250)');
      return;
    }

    const newPrinter: PrinterDevice = {
      id: 'p_' + Date.now(),
      name: newPrinterName.trim(),
      driverName: newPrinterDriver.trim() || newPrinterName.trim(),
      isOnline: true,
      supportsColor: newSupportsColor,
      supportsDuplex: newSupportsDuplex,
      assignedTypes: newAssignedTypes.length ? newAssignedTypes : ['BW'],
      status: 'IDLE'
    };

    const updatedPrinters = [...(shop.activePrinters || []), newPrinter];
    setShop({
      ...shop,
      activePrinters: updatedPrinters
    });

    setNewPrinterName('');
    setNewPrinterDriver('');
    setShowAddPrinter(false);
  };

  const handleDeletePrinter = (printerId: string) => {
    const updatedPrinters = (shop.activePrinters || []).filter(p => p.id !== printerId);
    setShop({
      ...shop,
      activePrinters: updatedPrinters
    });
  };

  const togglePrinterStatus = (printerId: string) => {
    const updatedPrinters = (shop.activePrinters || []).map(p => {
      if (p.id === printerId) {
        return { ...p, isOnline: !p.isOnline };
      }
      return p;
    });
    setShop({
      ...shop,
      activePrinters: updatedPrinters
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
        {/* Breadcrumb Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Live Orders</span>
          </Link>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700 transition active:scale-95 disabled:opacity-60"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-white" />
                <span>Saved Successfully!</span>
              </>
            ) : isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Pricing & Printer Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Shop Profile & UPI Payment Settings */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">1. Shop Profile & UPI Payments</h2>
                  <p className="text-xs text-slate-500">Configure where customer payments go and how prints trigger</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Shop Display Name
                  </label>
                  <input
                    type="text"
                    value={shop.name}
                    onChange={(e) => setShop({ ...shop, name: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Counter Contact Phone
                  </label>
                  <input
                    type="text"
                    value={shop.phone}
                    onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Shop UPI ID / VPA (Payments go directly to your Bank)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210@paytm or yourshop@okhdfcbank"
                    value={shop.upiId}
                    onChange={(e) => setShop({ ...shop, upiId: e.target.value.trim() })}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    100% direct bank transfer via NPCI UPI with zero gateway fees.
                  </p>
                </div>
              </div>

              {/* Auto-Print Security Control */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">
                      Auto-Print Silently on UPI Confirmation
                    </span>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      {shop.autoPrintOnUpi ? (
                        <span className="text-emerald-700 font-medium">
                          ⚡ Enabled: Printer immediately starts when customer clicks "Confirm UPI".
                        </span>
                      ) : (
                        <span className="text-indigo-700 font-medium">
                          🛡️ Verification Mode (Safe): Orders arrive in queue with customer's UTR number. You click "Print Now" after hearing your Soundbox announcement.
                        </span>
                      )}
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={shop.autoPrintOnUpi}
                      onChange={(e) => setShop({ ...shop, autoPrintOnUpi: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* 2. Custom Rate Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">2. Base Printing Rates</h2>
                  <p className="text-xs text-slate-500">Live prices shown to customers scanning your QR</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    B&W Single-Sided (₹)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={shop.pricing.bwSinglePaise / 100}
                    onChange={(e) => updatePricing('bwSinglePaise', Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    B&W Both-Sides / Duplex (₹)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={shop.pricing.bwDoublePaise / 100}
                    onChange={(e) => updatePricing('bwDoublePaise', Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Color Single-Sided (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={shop.pricing.colorSinglePaise / 100}
                    onChange={(e) => updatePricing('colorSinglePaise', Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Color Both-Sides / Duplex (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={shop.pricing.colorDoublePaise / 100}
                    onChange={(e) => updatePricing('colorDoublePaise', Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Expanded Paper Size Multipliers */}
              <div className="border-t border-slate-100 pt-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  Paper Format Multipliers (Rate Factor)
                </span>
                <p className="text-xs text-slate-500 mb-3">Adjust rate multiplier for specialized paper sizes (e.g. 2.0x for A3, 1.25x for Legal):</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'A4', name: 'A4 (Standard)', default: 1.0 },
                    { id: 'LEGAL', name: 'Legal / Stamp', default: 1.25 },
                    { id: 'A3', name: 'A3 Jumbo', default: 2.0 },
                    { id: 'A5', name: 'A5 Booklet', default: 0.75 },
                    { id: 'PHOTO_4X6', name: '4×6 Photo', default: 2.5 },
                    { id: 'LETTER', name: 'Letterhead', default: 1.0 },
                    { id: 'B5', name: 'B5 Book', default: 1.0 },
                  ].map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1 truncate">{item.name}</label>
                      <input
                        type="number"
                        step="0.05"
                        value={(shop.pricing?.paperSizeMultipliers as any)?.[item.id] ?? item.default}
                        onChange={(e) => updatePaperMultiplier(item.id as PaperSize, parseFloat(e.target.value || '1.0'))}
                        className="w-full h-9 rounded-lg border border-slate-200 px-2 text-xs font-black text-indigo-700 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Binding Add-ons */}
              <div className="border-t border-slate-100 pt-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3">
                  Binding & Finishing Rates
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Spiral (₹)</label>
                    <input
                      type="number"
                      value={shop.pricing.bindingRatesPaise.spiral / 100}
                      onChange={(e) => setShop({
                        ...shop,
                        pricing: {
                          ...shop.pricing,
                          bindingRatesPaise: { ...shop.pricing.bindingRatesPaise, spiral: Math.round(parseFloat(e.target.value || '0') * 100) }
                        }
                      })}
                      className="w-full h-10 rounded-xl border border-slate-200 px-2.5 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Soft (₹)</label>
                    <input
                      type="number"
                      value={shop.pricing.bindingRatesPaise.soft / 100}
                      onChange={(e) => setShop({
                        ...shop,
                        pricing: {
                          ...shop.pricing,
                          bindingRatesPaise: { ...shop.pricing.bindingRatesPaise, soft: Math.round(parseFloat(e.target.value || '0') * 100) }
                        }
                      })}
                      className="w-full h-10 rounded-xl border border-slate-200 px-2.5 text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Lamination (₹)</label>
                    <input
                      type="number"
                      value={shop.pricing.bindingRatesPaise.lamination / 100}
                      onChange={(e) => setShop({
                        ...shop,
                        pricing: {
                          ...shop.pricing,
                          bindingRatesPaise: { ...shop.pricing.bindingRatesPaise, lamination: Math.round(parseFloat(e.target.value || '0') * 100) }
                        }
                      })}
                      className="w-full h-10 rounded-xl border border-slate-200 px-2.5 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Connected Printers & Routing Rules (Full Multi-Printer Manager) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Printer className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">3. Connected Printers & Routing</h2>
                    <p className="text-xs text-slate-500">Works with any physical printer (Canon, HP, Epson, Brother, Ricoh, TVS &amp; more)</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddPrinter(!showAddPrinter)}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Printer</span>
                </button>
              </div>

              {/* Add Printer Form */}
              {showAddPrinter && (
                <div className="p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 space-y-3 animate-in fade-in">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Add New Hardware Printer
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Printer Name / Model *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Canon imageRUNNER 2525"
                        value={newPrinterName}
                        onChange={(e) => setNewPrinterName(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Windows Driver Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Canon UFR II LT"
                        value={newPrinterDriver}
                        onChange={(e) => setNewPrinterDriver(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSupportsColor}
                        onChange={(e) => setNewSupportsColor(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Supports Color Printing</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSupportsDuplex}
                        onChange={(e) => setNewSupportsDuplex(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Supports Automatic Duplex (Both sides)</span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddPrinter(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPrinter}
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow hover:bg-indigo-700"
                    >
                      Save Printer Device
                    </button>
                  </div>
                </div>
              )}

              {/* Printer List */}
              <div className="space-y-3 pt-2">
                {(shop.activePrinters || []).map(printer => (
                  <div
                    key={printer.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-700 border border-slate-200">
                        <Printer className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{printer.name}</span>
                          <button
                            type="button"
                            onClick={() => togglePrinterStatus(printer.id)}
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              printer.isOnline 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${printer.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            {printer.isOnline ? 'Online' : 'Offline'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {printer.supportsColor ? '🎨 Color InkTank/Laser' : '⚫ B&W High-Speed Laser'} · {printer.supportsDuplex ? 'Duplex Enabled' : 'Simplex'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hidden sm:inline-block">
                        Spooler Linked
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePrinter(printer.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Remove Printer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {(!shop.activePrinters || shop.activePrinters.length === 0) && (
                  <p className="text-xs text-slate-500 text-center py-4">
                    No printers connected. Click "+ Add Printer" above to configure your machines.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Downloadable Counter QR Standee */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center space-y-4">
              <h3 className="text-base font-bold text-slate-900">Counter QR Standee</h3>
              <p className="text-xs text-slate-500">
                Place this QR stand on your Xerox counter. Customers scan to upload and pay.
              </p>

              {/* Visual Standee Preview with High-Res PNG Logo */}
              <div 
                id="printable-standee" 
                className="mx-auto max-w-[320px] rounded-3xl bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-900 p-6 text-white text-center shadow-xl space-y-3.5 border-4 border-indigo-400/40"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
                    <Image src="/logo.png" alt="PagePrint" fill className="object-contain" />
                  </div>
                  <span className="font-black text-base tracking-tight text-white">
                    Page<span className="text-cyan-400">Print</span>
                  </span>
                </div>

                <div className="bg-white p-3 rounded-2xl shadow-inner inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://pageprint.in/shop/${shop.slug}`)}`}
                    alt="Counter QR Code"
                    className="h-36 w-36 object-contain"
                  />
                </div>

                <div>
                  <h4 className="text-lg font-black tracking-tight text-white">
                    {shop.name}
                  </h4>
                </div>

                <div className="rounded-2xl bg-white/10 p-3 text-slate-200 space-y-2.5 text-left border border-white/10">
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-400 text-slate-950 font-black text-[11px] mt-0.5 shadow-sm">
                      1
                    </span>
                    <div>
                      <p className="font-bold text-white text-xs">Scan QR with Mobile</p>
                      <p className="text-[10px] text-slate-300 leading-normal">
                        Use Google Lens or any scanner app to launch shop portal.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-400 text-slate-950 font-black text-[11px] mt-0.5 shadow-sm">
                      2
                    </span>
                    <div>
                      <p className="font-bold text-white text-xs">Upload Document &amp; Select Options</p>
                      <p className="text-[10px] text-slate-300 leading-normal">
                        Upload PDF or Front + Back ID. Select Color/B&amp;W, paper size, orientation &amp; copies.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-400 text-slate-950 font-black text-[11px] mt-0.5 shadow-sm">
                      3
                    </span>
                    <div>
                      <p className="font-bold text-white text-xs">Pay UPI &amp; Collect Prints</p>
                      <p className="text-[10px] text-slate-300 leading-normal">
                        Pay instantly with any UPI app or Cash at counter and collect your prints.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Print Standee Button */}
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition shadow"
              >
                <Download className="h-4 w-4" />
                <span>Print Counter Standee (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
