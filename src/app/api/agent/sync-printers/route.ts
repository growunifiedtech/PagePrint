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

    // Filter out virtual printers (OneNote, Print to PDF, XPS, Fax)
    const virtualTokens = ['onenote', 'print to pdf', 'xps', 'fax', 'pdf printer', 'adobe pdf', 'send to', 'nul:', 'portprompt:'];
    const isVirtual = (p: any) => {
      const text = `${p.Name || p.name || ''} ${p.DriverName || p.driverName || ''} ${p.PortName || p.portName || ''}`.toLowerCase();
      return virtualTokens.some(tok => text.includes(tok));
    };

    const physicalPrinters = printers.filter((p: any) => !isVirtual(p));
    const effectivePrinters = physicalPrinters.length > 0 ? physicalPrinters : printers;

    // Map real Windows physical printers detected by PowerShell Get-Printer
    const realPrinters: PrinterDevice[] = effectivePrinters.map((p: any, idx: number) => {
      const isColor = Boolean(p.Color) || 
        p.Name?.toLowerCase().includes('color') || 
        p.DriverName?.toLowerCase().includes('color') ||
        p.DriverName?.toLowerCase().includes('epson') ||
        p.DriverName?.toLowerCase().includes('deskjet') ||
        p.DriverName?.toLowerCase().includes('inktank') ||
        p.DriverName?.toLowerCase().includes('canon') ||
        p.DriverName?.toLowerCase().includes('hp');

      const isDuplex = Boolean(p.Duplex) || 
        p.Name?.toLowerCase().includes('duplex') || 
        p.DriverName?.toLowerCase().includes('imageRUNNER') ||
        p.DriverName?.toLowerCase().includes('laserjet');

      return {
        id: 'win_' + String(p.PortName || idx).replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Date.now(),
        name: String(p.Name || 'Physical Printer'),
        driverName: String(p.DriverName || p.Name || 'Generic Driver'),
        isOnline: true,
        supportsColor: Boolean(isColor),
        supportsDuplex: Boolean(isDuplex),
        assignedTypes: isColor ? ['COLOR', 'PHOTO', 'BW'] : ['BW', 'DUPLEX', 'LEGAL'],
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
