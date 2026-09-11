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
      const infoStr = `${p.Name || ''} ${p.DriverName || ''}`.toLowerCase();

      // Universal color detection across HP, Canon, Epson, Brother, Xerox, Ricoh, etc.
      const isColor = Boolean(p.Color) || 
        infoStr.includes('color') || 
        infoStr.includes('colour') || 
        infoStr.includes('ink') || 
        infoStr.includes('tank') || 
        infoStr.includes('deskjet') || 
        infoStr.includes('pixma') ||
        infoStr.includes('smart tank') ||
        infoStr.includes('ecotank') ||
        infoStr.includes('megatank') ||
        infoStr.includes('officejet');

      // Universal hardware auto-duplex detection across all printer manufacturers
      const isDuplex = Boolean(p.Duplex) || 
        infoStr.includes('duplex') || 
        infoStr.includes('dn') || 
        infoStr.includes('dw') || 
        infoStr.includes('fdn') || 
        infoStr.includes('fdw');

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
