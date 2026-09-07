import { NextRequest, NextResponse } from 'next/server';
import { db, getShopBySlugFromCloud, updateOrderStatusInCloud } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { deleteRawFileFromCloudinary } from '@/lib/cloudinary';
import { Order } from '@/types';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/agent/queue?shopSlug=xyz
 * Returns list of orders that are ready to be printed (printStatus === 'PRINTING')
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shopSlug = searchParams.get('shopSlug');

    if (!shopSlug) {
      return NextResponse.json({ error: 'shopSlug query param required' }, { status: 400 });
    }

    const shop = await getShopBySlugFromCloud(shopSlug);
    if (!shop) {
      return NextResponse.json({ error: `Shop "${shopSlug}" not found` }, { status: 404 });
    }

    const q = query(
      collection(db, 'orders'),
      where('shopId', '==', shop.id),
      where('printStatus', '==', 'PRINTING')
    );

    const snapshot = await getDocs(q);
    const orders: Order[] = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() } as Order);
    });

    return NextResponse.json({
      success: true,
      shop: { id: shop.id, name: shop.name, slug: shop.slug },
      orders
    });
  } catch (err: any) {
    console.error('Error fetching agent queue:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch queue' }, { status: 500 });
  }
}

/**
 * POST /api/agent/queue
 * Agent notifies server that a job has been physically spooled/printed.
 * Automatically marks order as PRINTED and permanently wipes customer files for privacy.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, status = 'PRINTED', publicId, fileUrl, backPublicId, backFileUrl } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // 1. Update order status in Firestore
    await updateOrderStatusInCloud(orderId, {
      printStatus: status,
      paymentStatus: 'PAID'
    });

    // 2. Trigger Instant Privacy Wipe
    try {
      if (publicId && publicId.startsWith('pageprint/')) {
        await deleteRawFileFromCloudinary(publicId);
      }
      if (backPublicId && backPublicId.startsWith('pageprint/')) {
        await deleteRawFileFromCloudinary(backPublicId);
      }

      if (fileUrl && fileUrl.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), 'public', fileUrl);
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      }
      if (backFileUrl && backFileUrl.startsWith('/uploads/')) {
        const localBackPath = path.join(process.cwd(), 'public', backFileUrl);
        if (fs.existsSync(localBackPath)) fs.unlinkSync(localBackPath);
      }
    } catch (wipeErr) {
      console.warn('Privacy wipe error during agent print completion:', wipeErr);
    }

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} marked as ${status} and files permanently wiped.`
    });
  } catch (err: any) {
    console.error('Error updating agent queue job:', err);
    return NextResponse.json({ error: err.message || 'Failed to update job' }, { status: 500 });
  }
}
