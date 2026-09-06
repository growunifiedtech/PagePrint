'use client';

import { Shop, Order, PricingConfig, ColorMode, PaperSize } from '@/types';
import { syncOrderToCloud, updateCloudOrderStatus } from './firebase';

// Default pre-configured demo shops
export const INITIAL_SHOPS: Shop[] = [
  {
    id: 'shop_krishna',
    name: 'Krishna Xerox & Fast Prints',
    slug: 'krishna-xerox',
    ownerName: 'Rajesh Sharma',
    phone: '+91 98765 43210',
    upiId: 'krishnaxerox@okaxis',
    address: 'Shop #4, Metro Station Gate 2, University Campus',
    autoPrintOnUpi: true,
    pricing: {
      bwSinglePaise: 200, // ₹2.00
      bwDoublePaise: 300, // ₹3.00
      colorSinglePaise: 1000, // ₹10.00
      colorDoublePaise: 1800, // ₹18.00
      paperSizeMultipliers: {
        A4: 1.0,
        A3: 2.0,
        A5: 0.75,
        LEGAL: 1.25,
        LETTER: 1.0,
        PHOTO_4X6: 2.5,
        B5: 1.0
      },
      bindingRatesPaise: {
        spiral: 3000, // ₹30
        soft: 5000,   // ₹50
        lamination: 2000 // ₹20
      }
    },
    activePrinters: [
      {
        id: 'p_1',
        name: 'Canon imageRUNNER 2525 (High Speed)',
        driverName: 'Canon UFR II LT',
        isOnline: true,
        supportsColor: false,
        supportsDuplex: true,
        assignedTypes: ['BW', 'DUPLEX', 'LEGAL'],
        status: 'IDLE'
      },
      {
        id: 'p_2',
        name: 'Epson EcoTank L3250 (Photo Color)',
        driverName: 'Epson ESC/P-R',
        isOnline: true,
        supportsColor: true,
        supportsDuplex: false,
        assignedTypes: ['COLOR'],
        status: 'IDLE'
      }
    ],
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'shop_campus',
    name: 'Campus Quick Xerox',
    slug: 'campus-prints',
    ownerName: 'Amit Verma',
    phone: '+91 98123 45678',
    upiId: 'campusprints@upi',
    address: 'Opposite Central Library, College Road',
    autoPrintOnUpi: true,
    pricing: {
      bwSinglePaise: 150,
      bwDoublePaise: 250,
      colorSinglePaise: 800,
      colorDoublePaise: 1500,
      paperSizeMultipliers: {
        A4: 1.0,
        A3: 2.0,
        A5: 0.75,
        LEGAL: 1.25,
        LETTER: 1.0,
        PHOTO_4X6: 2.5,
        B5: 1.0
      },
      bindingRatesPaise: {
        spiral: 2500,
        soft: 4000,
        lamination: 1500
      }
    },
    activePrinters: [
      {
        id: 'p_3',
        name: 'HP LaserJet Pro 4104 (Heavy Duty)',
        isOnline: true,
        supportsColor: false,
        supportsDuplex: true,
        assignedTypes: ['BW', 'DUPLEX'],
        status: 'IDLE'
      }
    ],
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  }
];

const SHOPS_KEY = 'pageprint_shops';
const ORDERS_KEY = 'pageprint_orders';

export function getStoredShops(): Shop[] {
  if (typeof window === 'undefined') return INITIAL_SHOPS;
  try {
    const raw = localStorage.getItem(SHOPS_KEY);
    if (!raw) {
      localStorage.setItem(SHOPS_KEY, JSON.stringify(INITIAL_SHOPS));
      return INITIAL_SHOPS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SHOPS;
  }
}

export function getShopBySlug(slug: string): Shop | undefined {
  const shops = getStoredShops();
  return shops.find(s => s.slug === slug) || shops[0];
}

export function updateShop(updatedShop: Shop): void {
  if (typeof window === 'undefined') return;
  const shops = getStoredShops().map(s => s.id === updatedShop.id ? updatedShop : s);
  localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
  notifyChange('shops');
}

export function getStoredOrders(shopId?: string): Order[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    const orders: Order[] = raw ? JSON.parse(raw) : [];
    if (shopId) {
      return orders.filter(o => o.shopId === shopId);
    }
    return orders;
  } catch {
    return [];
  }
}

export function saveOrder(order: Order): void {
  if (typeof window === 'undefined') return;
  const orders = getStoredOrders();
  const existingIdx = orders.findIndex(o => o.id === order.id);
  if (existingIdx >= 0) {
    orders[existingIdx] = order;
  } else {
    orders.unshift(order);
  }
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  notifyChange('orders');
  // Sync to Firebase Cloud if connected
  syncOrderToCloud(order);
}

export function updateOrderStatus(orderId: string, updates: Partial<Order>): Order | null {
  if (typeof window === 'undefined') return null;
  const orders = getStoredOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return null;
  const updated = { ...order, ...updates, updatedAt: new Date().toISOString() };
  saveOrder(updated);
  // Sync to Firebase Cloud if connected
  updateCloudOrderStatus(orderId, updates);
  return updated;
}

export function calculateOrderPrice(
  pricing: PricingConfig,
  pages: number,
  colorMode: ColorMode,
  isDuplex: boolean,
  copies: number,
  paperSize: PaperSize,
  services: ('spiral' | 'soft' | 'lamination')[]
): {
  perSheetRatePaise: number;
  sheetsCount: number;
  printTotalPaise: number;
  addonTotalPaise: number;
  grandTotalPaise: number;
  grandTotalRupees: number;
} {
  const multiplier = pricing.paperSizeMultipliers[paperSize] || 1.0;
  
  let baseRatePaise = 0;
  if (colorMode === 'COLOR') {
    baseRatePaise = isDuplex ? pricing.colorDoublePaise : pricing.colorSinglePaise;
  } else {
    baseRatePaise = isDuplex ? pricing.bwDoublePaise : pricing.bwSinglePaise;
  }

  const adjustedRatePaise = Math.round(baseRatePaise * multiplier);
  const sheetsCount = isDuplex ? Math.ceil(pages / 2) : pages;
  const printTotalPaise = sheetsCount * adjustedRatePaise * copies;

  let addonTotalPaise = 0;
  services.forEach(srv => {
    addonTotalPaise += (pricing.bindingRatesPaise[srv] || 0) * copies;
  });

  const grandTotalPaise = printTotalPaise + addonTotalPaise;
  return {
    perSheetRatePaise: adjustedRatePaise,
    sheetsCount,
    printTotalPaise,
    addonTotalPaise,
    grandTotalPaise,
    grandTotalRupees: grandTotalPaise / 100
  };
}

function notifyChange(type: 'orders' | 'shops') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pageprint_sync', { detail: { type } }));
}
