import { NextRequest, NextResponse } from 'next/server';
import { getShopBySlugFromCloud, updateShopInCloud } from '@/lib/firebase';
import { PrinterDevice } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopSlug, printers } = body;

    if (!shopSlug || !Array.isArray(printers)) {
      return NextResponse.json(
        { error: 'Missing shopSlug or printers array' },
        { status: 400 }
      );
    }

    const shop = await getShopBySlugFromCloud(shopSlug);
    if (!shop) {
      return NextResponse.json(
        { error: `Shop with slug "${shopSlug}" not found` },
        { status: 404 }
      );
    }

    // Map real Windows printers detected by PowerShell Get-Printer
    const realPrinters: PrinterDevice[] = printers.map((p: any, idx: number) => {
      const isColor = Boolean(p.Color) || 
        p.Name?.toLowerCase().includes('color') || 
        p.DriverName?.toLowerCase().includes('color') ||
        p.DriverName?.toLowerCase().includes('epson') ||
        p.DriverName?.toLowerCase().includes('deskjet') ||
        p.DriverName?.toLowerCase().includes('inktank');

      const isDuplex = Boolean(p.Duplex) || 
        p.Name?.toLowerCase().includes('duplex') || 
        p.DriverName?.toLowerCase().includes('imageRUNNER') ||
        p.DriverName?.toLowerCase().includes('laserjet');

      return {
        id: 'win_' + (p.PortName || idx) + '_' + Date.now(),
        name: p.Name,
        driverName: p.DriverName || p.Name,
        isOnline: true,
        supportsColor: isColor,
        supportsDuplex: isDuplex,
        assignedTypes: isColor ? ['COLOR', 'PHOTO'] : ['BW', 'DUPLEX', 'LEGAL'],
        status: 'IDLE',
        lastPing: new Date().toISOString()
      };
    });

    // Update real shop profile in Firestore
    await updateShopInCloud(shop.id, {
      activePrinters: realPrinters
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${realPrinters.length} physical printer(s) to ${shop.name}`,
      printers: realPrinters
    });
  } catch (error: any) {
    console.error('Error syncing printers:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
