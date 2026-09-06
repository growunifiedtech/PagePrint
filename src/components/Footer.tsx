import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShieldCheck, Zap, Printer, Mail, Phone, MessageCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white border border-indigo-100 p-0.5 shadow-sm">
                <Image src="/logo.png" alt="PagePrint Logo" fill className="object-contain" />
              </div>
              <span className="text-xl font-black text-slate-900">
                Page<span className="text-indigo-600">Print</span>
              </span>
            </div>
            <p className="text-sm text-slate-600 max-w-sm">
              Smart QR and UPI print automation software for Xerox centres, stationery stores, and college print hubs. Eliminate WhatsApp queues forever.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Instant Delete After Print (100% Private)
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-amber-500" />
                Zero Counter Delay
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Navigation &amp; Plans
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600 font-medium">
              <li>
                <Link href="/#how-it-works" className="hover:text-indigo-600 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-indigo-600 transition-colors">
                  Features &amp; Automation
                </Link>
              </li>
              <li>
                <Link href="/#contact" className="hover:text-indigo-600 transition-colors">
                  Contact &amp; Setup
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-indigo-600 transition-colors">
                  Merchant Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-indigo-600 transition-colors">
                  Register Your Shop
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Security &amp; Trust
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>Instant UPI Verification</li>
              <li>Instant File Deletion on Print</li>
              <li>Silent Windows Print Spooler</li>
              <li>Built for Fast-Paced Xerox Counters</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Direct Contact
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600 font-medium">
              <li>
                <a href="mailto:growunifiedtech@gmail.com" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate text-xs">growunifiedtech@gmail.com</span>
                </a>
              </li>
              <li>
                <a href="tel:7057985925" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs">+91 7057985925</span>
                </a>
              </li>
              <li>
                <a href="https://wa.me/917057985925" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 transition-colors flex items-center gap-1.5 font-bold text-emerald-700 text-xs">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>WhatsApp Chat ↗</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} PagePrint Inc. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" /> for modern print shop entrepreneurs.
          </p>
        </div>
      </div>
    </footer>
  );
}
