'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, QrCode, ArrowRight, LogIn, LogOut, Menu, X } from 'lucide-react';
import { useAuth, logoutUser } from '@/lib/auth';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, shop, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDashboard = pathname.startsWith('/dashboard');

  const handleLogout = async () => {
    await logoutUser();
    router.push('/login');
  };

  const handleNavClick = (e: React.MouseEvent, targetId: string) => {
    setMobileMenuOpen(false);
    if (pathname === '/') {
      e.preventDefault();
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Slogan */}
        <Link href={isDashboard ? "/dashboard" : "/"} className="flex items-center gap-3 shrink-0 group py-1">
          <div className="relative h-11 w-11 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-xs transition-all group-hover:scale-105">
            <Image
              src="/logo.png"
              alt="PagePrint Official Logo"
              fill
              className="object-contain p-0.5"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
              Page<span className="text-indigo-600">Print</span>
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 leading-tight hidden md:block">
              Smart Self Printing For Xerox &amp; Printing Shops
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        {isDashboard ? (
          /* MERCHANT DASHBOARD CONTROLS (Single, non-duplicated buttons, Live Queue removed) */
          <nav className="hidden md:flex items-center gap-3 text-sm font-semibold">
            {shop?.slug && (
              <Link
                href={`/shop/${shop.slug}`}
                target="_blank"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 transition border border-emerald-200 shadow-2xs font-bold text-xs"
              >
                <QrCode className="h-4 w-4" />
                <span>Customer Portal ↗</span>
              </Link>
            )}

            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition text-xs font-bold ${
                pathname === '/dashboard/settings'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 shadow-2xs'
              }`}
            >
              <Settings className="h-4 w-4 text-slate-500" />
              <span>Pricing &amp; Printers</span>
            </Link>

            <button
              onClick={handleLogout}
              title="Logout"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition shadow-2xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </nav>
        ) : (
          /* PUBLIC WEBSITE NAVIGATION */
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <Link 
              href="/#how-it-works" 
              onClick={(e) => handleNavClick(e, 'how-it-works')}
              className="hover:text-indigo-600 transition-colors"
            >
              How It Works
            </Link>
            <Link 
              href="/#features" 
              onClick={(e) => handleNavClick(e, 'features')}
              className="hover:text-indigo-600 transition-colors"
            >
              Features
            </Link>
            <Link 
              href="/#contact" 
              onClick={(e) => handleNavClick(e, 'contact')}
              className="hover:text-indigo-600 transition-colors"
            >
              Contact &amp; Setup
            </Link>

          </nav>
        )}

        {/* Desktop Action Buttons (Only for non-dashboard pages) */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg"></div>
          ) : isDashboard ? null : user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-indigo-600 px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition shadow-xs"
              >
                <LayoutDashboard className="h-4 w-4 text-indigo-600" />
                <span>Dashboard</span>
              </Link>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-indigo-600 px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <LogIn className="h-4 w-4 text-indigo-600" />
                <span>Merchant Login</span>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-all hover:shadow"
              >
                <span>Register Shop</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-4 shadow-lg animate-in slide-in-from-top-2">
          {isDashboard ? (
            /* MERCHANT DASHBOARD MOBILE MENU (No Live Queue, single controls) */
            <nav className="flex flex-col space-y-2 text-sm font-semibold text-slate-700">
              <Link
                href="/dashboard/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 py-2.5 px-3 rounded-lg transition ${
                  pathname === '/dashboard/settings' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>Pricing &amp; Printers</span>
              </Link>
              {shop?.slug && (
                <Link
                  href={`/shop/${shop.slug}`}
                  target="_blank"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 py-2.5 px-3 rounded-lg text-emerald-700 bg-emerald-50 font-bold"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Customer Portal ↗</span>
                </Link>
              )}
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition mt-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout Account</span>
              </button>
            </nav>
          ) : (
            /* PUBLIC MOBILE MENU */
            <>
              <nav className="flex flex-col space-y-2 text-sm font-semibold text-slate-700">
                <Link 
                  href="/#how-it-works" 
                  onClick={(e) => handleNavClick(e, 'how-it-works')}
                  className="py-2 px-3 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition"
                >
                  How It Works
                </Link>
                <Link 
                  href="/#features" 
                  onClick={(e) => handleNavClick(e, 'features')}
                  className="py-2 px-3 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition"
                >
                  Features
                </Link>
                <Link 
                  href="/#contact" 
                  onClick={(e) => handleNavClick(e, 'contact')}
                  className="py-2 px-3 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition"
                >
                  Contact &amp; Setup
                </Link>

              </nav>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Merchant Dashboard</span>
                    </Link>
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout Account</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <LogIn className="h-4 w-4 text-indigo-600" />
                      <span>Merchant Login</span>
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                    >
                      <span>Register Shop Free</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
