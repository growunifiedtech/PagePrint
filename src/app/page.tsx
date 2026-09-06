'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Printer, QrCode, Zap, ShieldCheck, Check, ArrowRight, 
  Sparkles, Layers, RefreshCw, IndianRupee, Clock, ChevronRight, 
  CheckCircle2, Laptop, Smartphone, HelpCircle, LogIn, LayoutDashboard, Mail, Phone, MessageCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function HomePage() {
  const { user, shop, loading } = useAuth();
  const [dailyPrints, setDailyPrints] = useState(150);
  const [inquiryShopName, setInquiryShopName] = useState('');
  const [inquiryCity, setInquiryCity] = useState('');
  const [inquiryPrinters, setInquiryPrinters] = useState('');

  const handleWhatsAppInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `Hello PagePrint Team,%0A%0AI want to get started with PagePrint for my shop.%0A%0A🏪 *Shop Name*: ${encodeURIComponent(inquiryShopName || 'My Print Shop')}%0A📍 *City*: ${encodeURIComponent(inquiryCity || 'Not specified')}%0A🖨️ *Printers*: ${encodeURIComponent(inquiryPrinters || 'Any')}%0A%0APlease contact me to guide setup!`;
    window.open(`https://wa.me/917057985925?text=${text}`, '_blank');
  };

  // ROI Calculator Math: average 1.5 mins wasted per WhatsApp print
  const minutesSavedDaily = Math.round((dailyPrints * 1.5));
  const hoursSavedMonthly = Math.round((minutesSavedDaily * 30) / 60);
  const extraRevenueMonthly = Math.round(dailyPrints * 30 * 0.75); // ₹0.75 extra profit from faster turnover

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-indigo-50/50 via-white to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Prominent PagePrint Brand Header */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-white p-1 shadow-md shadow-indigo-100/50">
                <Image
                  src="/logo.png"
                  alt="PagePrint Official Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="text-center sm:text-left space-y-1">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 block leading-tight">
                  Page<span className="text-indigo-600">Print</span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-500 block leading-normal">
                  Smart Self Printing For Xerox &amp; Printing Shops
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-200/70 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span>Zero WhatsApp Queues • 100% Automated Counter Xerox</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl sm:leading-none">
              Eliminate WhatsApp Print Queues Forever.
              <span className="block text-indigo-600 mt-2">Zero Clicks. Auto-Printed.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Walk-in customers scan your counter QR, choose B&amp;W or Color, and pay via UPI. Your physical printer automatically prints the document without you touching your computer.
            </p>

            {/* Authenticated vs Guest Hero Actions */}
            {loading ? (
              <div className="flex items-center justify-center gap-3 pt-2 h-14">
                <div className="h-12 w-48 bg-indigo-100/50 animate-pulse rounded-xl"></div>
              </div>
            ) : user ? (
              /* ONLY LOGGED-IN SHOP OWNERS SEE THIS */
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-center">
                  <Link
                    href="/dashboard"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 hover:shadow-indigo-500/25 transition active:scale-95"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Go to Merchant Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <p className="text-xs text-indigo-600 font-semibold">
                  Logged in as {shop?.name || user.email}
                </p>
              </div>
            ) : (
              /* VISITORS / LOGGED-OUT USERS SEE THIS */
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 hover:shadow-indigo-500/25 transition active:scale-95"
                >
                  <span>Register Your Shop Free</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 transition shadow-xs"
                >
                  <LogIn className="h-4 w-4 text-indigo-600" />
                  <span>Merchant Login</span>
                </Link>
              </div>
            )}

            {/* Micro proof tags */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Works with Any Printer
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Instant UPI Payment Confirmation
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                100% Private (Instant Delete After Print)
              </span>
            </div>
          </div>

          {/* Workflow Interactive Visual Card (How It Works) */}
          <div id="how-it-works" className="mt-16 max-w-4xl mx-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 scroll-mt-24">
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                3-Step Automation
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                How PagePrint Works at Your Counter
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Zero WhatsApp downloads. Zero waiting. 100% automated.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Step 1 */}
              <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="font-bold text-slate-900 text-base">Customer Scans QR</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  No app installation needed. Opens on customer mobile browser using Google Lens or scanner. Selects PDF or Front + Back ID, Color/B&amp;W, Duplex, and Copies.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 className="font-bold text-slate-900 text-base">Pays Exact UPI Amount</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Page count is counted automatically with live pricing. Customer pays via any UPI app or Cash. Zero disputes over change.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="font-bold text-slate-900 text-base">Paper Auto-Prints</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The local desktop agent detects the paid order and triggers silent Windows printing instantly to your machine.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison: Old WhatsApp Way vs PagePrint Way */}
      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Why Print Shops Are Switching to PagePrint
            </h2>
            <p className="text-sm text-slate-600">
              Save 2+ hours daily, stop virus infections, and never argue over unpaid prints.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Old Way */}
            <div className="rounded-2xl border border-rose-200 bg-white p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <span className="h-2 w-2 rounded-full bg-rose-600"></span>
                The Painful Old Way (WhatsApp Web)
              </div>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">✕</span>
                  <span>10 students shouting at the counter: <em>"Bhaiya check karo, bhej diya!"</em></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">✕</span>
                  <span>Shopkeeper wastes 4 minutes downloading, counting pages, and opening Acrobat.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">✕</span>
                  <span>Viruses infect your counter PC from strange customer files.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">✕</span>
                  <span>Customers rush off during exam rush without paying for prints.</span>
                </li>
              </ul>
            </div>

            {/* The PagePrint Way */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
                The Automated PagePrint Way
              </div>
              <ul className="space-y-3 text-xs text-slate-700 font-medium">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Customers scan counter QR and self-configure on their own mobile.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Automatic page counting &amp; price calculation in 1 second.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>UPI payment is confirmed before any paper or ink is used.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Hands-free printing: physical printer starts spitting paper automatically!</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-white scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              Powerful Features
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Engineered Specially for Xerox &amp; Print Shops
            </h2>
            <p className="text-sm text-slate-600">
              Everything you need to run high-speed counter printing with zero manual intervention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Zero-Click Windows Auto-Print</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our lightweight Windows desktop agent silently communicates with your printer spooler. Print jobs execute the exact moment UPI payment is confirmed.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <IndianRupee className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Instant UPI Payment Lock</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dynamic QR codes generate the exact amount. Works with any UPI app. No paper is ever wasted on unpaid orders.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Front + Back Xerox Mode</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dedicated dual upload for Aadhaar cards, Voter IDs, and Bank passbooks with Same-Side 1-page Xerox or Double-Sided Duplex layouts.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-sm">
                <Printer className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Live Paper Print Preview</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customers view their document across 7 paper sizes (A4, Legal, Letter, A3, etc.), preview B&amp;W vs Color toner, and customize page ranges.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">100% Customer Privacy (Instant Deletion)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customer documents are 100% private. The moment a job finishes printing or is marked complete, files are instantly and permanently deleted. Zero trace, zero stored documents, and your counter PC stays clean and virus-free.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-3 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multi-Printer Smart Routing</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect multiple printers simultaneously. Black &amp; White documents automatically route to your high-volume monochrome machine, and photos route to color.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Savings & ROI Calculator */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-8 text-white shadow-xl">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                Calculator
              </span>
              <h2 className="text-2xl font-black text-white sm:text-3xl">
                See How Much You Save with PagePrint
              </h2>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <div className="flex justify-between text-sm font-semibold mb-2">
                  <span>How many customer print orders do you handle daily?</span>
                  <span className="text-cyan-400 font-bold text-base">{dailyPrints} orders/day</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="500"
                  step="10"
                  value={dailyPrints}
                  onChange={(e) => setDailyPrints(Number(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-center">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-xs text-slate-300 block">Time Saved Every Month</span>
                  <span className="text-2xl sm:text-3xl font-black text-cyan-300 mt-1 block">
                    {hoursSavedMonthly} Hours
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-xs text-slate-300 block">Extra Capacity / Month</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1 block">
                    +₹{extraRevenueMonthly.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-xs text-slate-300 block">Counter Stress</span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-300 mt-1 block">
                    0% Chaos
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Direct WhatsApp Shop Inquiry & Quick Onboarding */}
      <section id="contact" className="py-16 bg-slate-50 border-t border-slate-200 scroll-mt-24 relative">
        <div id="pricing" className="absolute -top-24" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left description */}
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  <MessageCircle className="h-4 w-4 text-emerald-400" />
                  <span>Direct WhatsApp Onboarding</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Ready to Automate Your Counter? Get Set Up in Minutes.
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Chat directly with our setup engineers. Send your shop details on WhatsApp or give us a direct call, and we will get your counter live and auto-printing.
                </p>

                {/* Direct Contact Badges */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <a
                    href="https://wa.me/917057985925"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition active:scale-95"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp: +91 7057985925</span>
                  </a>

                  <a
                    href="tel:7057985925"
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2.5 text-xs font-bold text-white border border-white/15 transition active:scale-95"
                  >
                    <Phone className="h-3.5 w-3.5 text-cyan-300" />
                    <span>Call: +91 7057985925</span>
                  </a>

                  <a
                    href="mailto:growunifiedtech@gmail.com"
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2.5 text-xs font-bold text-white border border-white/15 transition active:scale-95"
                  >
                    <Mail className="h-3.5 w-3.5 text-indigo-300" />
                    <span>growunifiedtech@gmail.com</span>
                  </a>
                </div>
              </div>

              {/* Right interactive quick form */}
              <div className="lg:col-span-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-5 sm:p-6 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Quick Shop Details
                  </span>
                  <span className="text-[11px] text-slate-300 font-medium">1-Click WhatsApp Send</span>
                </div>

                <form onSubmit={handleWhatsAppInquiry} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Shop Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Balaji Xerox"
                        value={inquiryShopName}
                        onChange={(e) => setInquiryShopName(e.target.value)}
                        className="w-full h-10 rounded-xl bg-white/10 border border-white/20 px-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        City / Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Pune, Maharashtra"
                        value={inquiryCity}
                        onChange={(e) => setInquiryCity(e.target.value)}
                        className="w-full h-10 rounded-xl bg-white/10 border border-white/20 px-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Connected Printer Models
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Canon 2525, Epson L3250, HP LaserJet..."
                      value={inquiryPrinters}
                      onChange={(e) => setInquiryPrinters(e.target.value)}
                      className="w-full h-10 rounded-xl bg-white/10 border border-white/20 px-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 text-xs transition shadow-md active:scale-98 mt-2"
                  >
                    <MessageCircle className="h-4 w-4 text-slate-950" />
                    <span>Send Shop Details on WhatsApp &amp; Get Setup</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white text-center">
        <div className="mx-auto max-w-3xl px-4 space-y-6">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Ready to Automate Your Print Shop?
          </h2>
          <p className="text-sm text-slate-600">
            Set up your shop in under 2 minutes. Get your customized counter QR code immediately.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition"
            >
              <span>Onboard Your Shop Free</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
