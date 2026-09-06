export type ColorMode = 'BW' | 'COLOR';
export type Orientation = 'PORTRAIT' | 'LANDSCAPE';
export type UploadMode = 'SINGLE' | 'ID_DOUBLE_SIDED';
export type IdLayoutMode = 'SAME_SIDE' | 'SEPARATE_SIDES';
export type PaperSize = 'A4' | 'A3' | 'A5' | 'LEGAL' | 'LETTER' | 'PHOTO_4X6' | 'B5';
export type PaymentStatus = 'PENDING' | 'PAID' | 'CASH_AT_COUNTER';
export type PrintStatus = 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED';

export interface PricingConfig {
  bwSinglePaise: number;
  bwDoublePaise: number;
  colorSinglePaise: number;
  colorDoublePaise: number;
  paperSizeMultipliers: {
    A4: number;
    A3: number;
    A5: number;
    LEGAL: number;
    LETTER: number;
    PHOTO_4X6: number;
    B5: number;
  };
  bindingRatesPaise: {
    spiral: number;
    soft: number;
    lamination: number;
  };
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerId?: string;
  email?: string;
  phone: string;
  upiId: string;
  address: string;
  autoPrintOnUpi: boolean;
  pricing: PricingConfig;
  activePrinters: PrinterDevice[];
  createdAt: string;
}

export interface PrinterDevice {
  id: string;
  name: string;
  driverName?: string;
  isOnline: boolean;
  supportsColor: boolean;
  supportsDuplex: boolean;
  assignedTypes: ('BW' | 'COLOR' | 'DUPLEX' | 'LEGAL' | 'PHOTO' | 'LARGE_FORMAT')[];
  status: 'IDLE' | 'PRINTING' | 'ERROR' | 'OFFLINE';
  lastPing?: string;
}

export interface Order {
  id: string;
  tokenNumber: string;
  shopId: string;
  shopSlug: string;
  customerPhone: string;
  customerName?: string;
  fileName: string;
  fileSizeBytes: number;
  fileUrl: string;
  publicId?: string;
  pageCount: number;
  selectedPages: string;
  effectivePageCount: number;
  colorMode: ColorMode;
  isDuplex: boolean;
  paperSize: PaperSize;
  orientation?: Orientation;
  uploadMode?: UploadMode;
  idLayoutMode?: IdLayoutMode;
  backFileName?: string;
  backFileUrl?: string;
  backPublicId?: string;
  copies: number;
  additionalServices: ('spiral' | 'soft' | 'lamination')[];
  totalAmountPaise: number;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  printStatus: PrintStatus;
  targetPrinterName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  code: 'STARTER' | 'PRO' | 'SCALE' | 'LIFETIME';
  name: string;
  tagline: string;
  pricePaise: number;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
  maxPrinters: number;
  autoPrintEnabled: boolean;
  whatsappBot: boolean;
  popular?: boolean;
}
