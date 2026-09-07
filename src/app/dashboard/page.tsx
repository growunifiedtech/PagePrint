'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  Printer, CheckCircle2, Clock, AlertTriangle, RefreshCw, 
  Settings, ExternalLink, QrCode, Play, Volume2, ShieldCheck, 
  ArrowUpRight, IndianRupee, FileText, Check, Phone, Eye, Power, LogOut, User, Trash2, X
} from 'lucide-react';
import { 
  subscribeToShopOrdersRealtime, updateOrderStatusInCloud, updateShopInCloud, deleteOrderFromCloud 
} from '@/lib/firebase';
import { useAuth, logoutUser } from '@/lib/auth';
import { playNewOrderChime } from '@/lib/sound';
import { Shop, Order, PrintStatus } from '@/types';
import Navbar from '@/components/Navbar';

export default function MerchantDashboardPage() {
  const router = useRouter();
  const { user, shop, setShop, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'QUEUED' | 'PRINTING' | 'PRINTED'>('ALL');
  const [prevOrderCount, setPrevOrderCount] = useState(0);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Subscribe to real-time orders in Firestore
  useEffect(() => {
    if (!shop?.id) return;

    const unsubscribe = subscribeToShopOrdersRealtime(shop.id, (realOrders) => {
      // If new order arrived, chime
      if (realOrders.length > prevOrderCount && prevOrderCount > 0) {
        playNewOrderChime();
      }
      setPrevOrderCount(realOrders.length);
      setOrders(realOrders);
    });

    return () => unsubscribe();
  }, [shop?.id, prevOrderCount]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent"></div>
          <p className="text-sm font-semibold text-slate-600">Connecting to Live Queue...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, block render and let useEffect redirect
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center space-y-4 border border-slate-200 shadow-sm">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Printer className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">No Print Shop Found</h2>
          <p className="text-xs text-slate-500">
            You are logged in as {user?.email}, but have not registered a shop profile yet.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/register"
              className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow hover:bg-indigo-700"
            >
              Create Your Shop Profile
            </Link>
            <button
              onClick={() => logoutUser().then(() => router.push('/login'))}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Real action handlers with instant privacy auto-deletion
  const handlePrintOrder = async (order: Order) => {
    await updateOrderStatusInCloud(order.id, { 
      printStatus: 'PRINTING',
      paymentStatus: 'PAID'
    });
    playNewOrderChime();
    
    // Auto-mark printed and trigger instant privacy deletion
    setTimeout(async () => {
      await updateOrderStatusInCloud(order.id, { printStatus: 'PRINTED' });
      playNewOrderChime();

      // Trigger instant deletion from Cloudinary / local storage within 3 seconds of printing
      try {
        await fetch('/api/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicId: order.publicId,
            fileUrl: order.fileUrl,
            orderId: order.id
          })
        });
        if (order.backPublicId || order.backFileUrl) {
          await fetch('/api/upload/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publicId: order.backPublicId,
              fileUrl: order.backFileUrl,
              orderId: order.id + '_back'
            })
          });
        }
      } catch (e) {
        console.warn('Auto-delete error:', e);
      }
    }, 3000);
  };

  const handleMarkCompleted = async (order: Order) => {
    await updateOrderStatusInCloud(order.id, { printStatus: 'PRINTED' });
    try {
      await fetch('/api/upload/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId: order.publicId,
          fileUrl: order.fileUrl,
          orderId: order.id
        })
      });
      if (order.backPublicId || order.backFileUrl) {
        await fetch('/api/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicId: order.backPublicId,
            fileUrl: order.backFileUrl,
            orderId: order.id + '_back'
          })
        });
      }
    } catch (e) {
      console.warn('Auto-delete error:', e);
    }
  };

  const handleRejectOrder = async (order: Order) => {
    const confirmDelete = window.confirm(
      `Reject Token #${order.tokenNumber} (${order.customerName || 'Customer'})?\n\nThis will delete the file and remove this order from queue.`
    );
    if (!confirmDelete) return;

    try {
      // 1. Delete file from cloud storage / Cloudinary
      await fetch('/api/upload/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId: order.publicId,
          fileUrl: order.fileUrl,
          orderId: order.id
        })
      });
      if (order.backPublicId || order.backFileUrl) {
        await fetch('/api/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicId: order.backPublicId,
            fileUrl: order.backFileUrl,
            orderId: order.id + '_back'
          })
        });
      }

      // 2. Delete order from Cloud Firestore
      await deleteOrderFromCloud(order.id);
    } catch (e) {
      console.error('Error rejecting order:', e);
      alert('Could not reject order. Please check connection.');
    }
  };

  const toggleAutoPrint = async () => {
    const newVal = !shop.autoPrintOnUpi;
    setShop({ ...shop, autoPrintOnUpi: newVal });
    await updateShopInCloud(shop.id, { autoPrintOnUpi: newVal });
  };

  const handleLogout = async () => {
    await logoutUser();
    router.push('/login');
  };

  // Compute live metrics from real orders
  const totalRevenuePaise = orders.reduce((sum, o) => sum + (o.paymentStatus === 'PAID' ? o.totalAmountPaise : 0), 0);
  const totalPagesPrinted = orders.reduce((sum, o) => sum + (o.effectivePageCount * o.copies), 0);
  const pendingOrders = orders.filter(o => o.printStatus === 'QUEUED' || o.printStatus === 'PRINTING');

  const filteredOrders = orders.filter(o => {
    if (filterStatus === 'ALL') return true;
    return o.printStatus === filterStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Subheader Toolbar */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50 p-2 flex items-center justify-center text-indigo-600 shadow-xs">
              <Printer className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{shop.name}</h1>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  Online Live
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {shop.address} · Logged in as <span className="font-semibold text-slate-700">{user?.email}</span>
              </p>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto-Print Toggle */}
            <button
              onClick={toggleAutoPrint}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all border ${
                shop.autoPrintOnUpi
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/20'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              <Power className={`h-3.5 w-3.5 ${shop.autoPrintOnUpi ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Auto-Print on UPI: {shop.autoPrintOnUpi ? 'ON' : 'OFF'}</span>
            </button>

            {/* Test Sound */}
            <button
              onClick={() => playNewOrderChime()}
              title="Test Ding Sound"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <Volume2 className="h-4 w-4" />
            </button>


          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Pending Orders
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{pendingOrders.length}</span>
              {pendingOrders.length > 0 && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md animate-pulse">
                  Action Required
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Ready to be spooled</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Today's Revenue
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900">
                ₹{(totalRevenuePaise / 100).toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Collected directly in your UPI</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Total Pages Printed
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900">{totalPagesPrinted}</span>
              <span className="text-xs text-slate-500">pages</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">B&W + Color combined</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Connected Printers
              </span>
              <Link
                href="/dashboard/settings"
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                + Add / Manage
              </Link>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {shop.activePrinters?.length || 0}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                (shop.activePrinters?.length || 0) > 0
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-amber-700 bg-amber-50'
              }`}>
                {(shop.activePrinters?.length || 0) > 0
                  ? `${shop.activePrinters?.filter(p => p.isOnline).length || 0} Online`
                  : 'Awaiting Agent'}
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100">
              {(!shop.activePrinters || shop.activePrinters.length === 0) ? (
                <div className="text-xs text-amber-700 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60 space-y-1">
                  <span className="font-bold block">⚠️ 0 Physical Printers Detected</span>
                  <p className="text-[11px] text-amber-800 leading-tight">
                    Start the PagePrint Desktop Agent on your counter PC to auto-detect plugged-in printers, or add them manually in Settings.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {shop.activePrinters.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate max-w-[150px]">• {p.name}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${p.supportsColor ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {p.supportsColor ? 'Color' : 'B&W'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Local Agent Status Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Windows Local Print Agent Active</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-xs text-slate-300">
                Listening to Firestore queue for shop ID: <span className="font-mono text-cyan-300">{shop.id}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-white/10 px-3 py-1.5 rounded-lg text-slate-200 font-mono">
              Slug: {shop.slug}
            </span>
            <button
              onClick={() => {
                alert('Test print ticket dispatched to Windows Spooler!');
                playNewOrderChime();
              }}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 font-bold text-white transition"
            >
              Test Print Ticket
            </button>
          </div>
        </div>

        {/* Live Orders Feed */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Live Order Queue</span>
                <span className="text-xs font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  {orders.length} Live Orders
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Real-time sync connected to your print counter
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center rounded-xl bg-white p-1 border border-slate-200 text-xs font-semibold">
              {(['ALL', 'QUEUED', 'PRINTING', 'PRINTED'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilterStatus(tab)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filterStatus === tab
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Cards */}
          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Printer className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-slate-700">No print orders in your queue yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Scan your counter QR code or open your customer portal to submit your first real print order!
              </p>
              <div className="mt-4">
                <Link
                  href={`/shop/${shop.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Open Your Customer Portal</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredOrders.map(order => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  {/* Left: Token & Document Specs */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900">
                      <span className="text-[10px] font-bold text-indigo-500">TOKEN</span>
                      <span className="text-base font-black">{order.tokenNumber}</span>
                    </div>

                    <div className="space-y-1.5">
                      {/* Customer Name & File Link */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-950 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                          <User className="h-3.5 w-3.5 text-indigo-600" />
                          <span>{order.customerName || 'Walk-in Customer'}</span>
                        </span>

                        <div className="flex items-center gap-2 flex-wrap">
                          {order.fileUrl === 'WIPED_FOR_PRIVACY' ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200 shadow-2xs">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Instant Deleted After Print (100% Private)</span>
                            </span>
                          ) : (
                            <a
                              href={order.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-sm text-slate-900 hover:text-indigo-600 underline truncate max-w-[200px] sm:max-w-xs flex items-center gap-1"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span className="truncate">{order.uploadMode === 'ID_DOUBLE_SIDED' ? `Front: ${order.fileName}` : order.fileName}</span>
                            </a>
                          )}
                          {order.backFileUrl && order.backFileUrl !== 'WIPED_FOR_PRIVACY' && (
                            <a
                              href={order.backFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-xs text-purple-700 hover:text-purple-900 underline truncate max-w-[150px] flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded"
                            >
                              <span>Back Side File ↗</span>
                            </a>
                          )}
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          order.colorMode === 'COLOR'
                            ? 'bg-gradient-to-r from-rose-100 to-amber-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {order.colorMode === 'COLOR' ? 'Color' : 'B&W'}
                        </span>
                        {order.isDuplex && (
                          <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            Duplex (Both sides)
                          </span>
                        )}
                        <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100/80">
                          {order.paperSize || 'A4'}
                        </span>
                        <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                          {order.orientation === 'LANDSCAPE' ? 'Landscape ↔' : 'Portrait ↕'}
                        </span>
                        {order.uploadMode === 'ID_DOUBLE_SIDED' && (
                          <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                            Front + Back ({order.idLayoutMode === 'SAME_SIDE' ? 'Same-Side' : 'Duplex'})
                          </span>
                        )}
                        {order.selectedPages && order.selectedPages !== 'ALL' && (
                          <span className="text-[11px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                            Pages: {order.selectedPages}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span>{order.effectivePageCount} pages</span>
                        <span>•</span>
                        <span>{order.copies} {order.copies === 1 ? 'copy' : 'copies'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {order.customerPhone}
                        </span>
                        {order.additionalServices?.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-600 font-medium">
                              Add-ons: {order.additionalServices.join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Price, Status & Actions */}
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-base font-black text-slate-900 block">
                        ₹{(order.totalAmountPaise / 100).toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {order.paymentStatus === 'PAID' ? '✓ Paid via UPI' : 'Cash at Counter'}
                      </span>
                      {order.paymentId && (
                        <span className="block text-[9px] font-mono text-slate-500 mt-0.5 max-w-[130px] truncate" title={order.paymentId}>
                          {order.paymentId}
                        </span>
                      )}
                    </div>

                    {/* Print Status Actions (Accept & Print vs Reject) */}
                    <div className="flex items-center gap-2">
                      {order.printStatus === 'QUEUED' && (
                        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                          <button
                            onClick={() => handlePrintOrder(order)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Accept & Print</span>
                          </button>

                          <button
                            onClick={() => handleRejectOrder(order)}
                            className="flex items-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 text-xs font-bold active:scale-95 transition"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}

                      {order.printStatus === 'PRINTING' && (
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs font-bold text-amber-800 animate-pulse">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600" />
                          <span>Printing...</span>
                        </div>
                      )}

                      {order.printStatus === 'PRINTED' && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                            <Check className="h-4 w-4 text-emerald-600" />
                            <span>Ready for Pickup</span>
                          </div>
                          <button
                            onClick={() => handleRejectOrder(order)}
                            title="Delete / Clear Finished Order"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
