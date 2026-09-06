import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { deleteRawFileFromCloudinary } from '@/lib/cloudinary';
import { updateOrderStatusInCloud } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publicId, fileUrl, orderId } = body;

    let wiped = false;

    // 1. Wipe from Cloudinary if hosted there
    if (publicId && publicId.startsWith('pageprint/')) {
      wiped = await deleteRawFileFromCloudinary(publicId);
      console.log(`🔒 [Cloudinary] Document "${publicId}" permanently wiped for privacy.`);
    }

    // 2. Wipe from local disk if hosted on server
    if (fileUrl && fileUrl.startsWith('/uploads/')) {
      const localFilePath = path.join(process.cwd(), 'public', fileUrl);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        wiped = true;
        console.log(`🔒 [Disk] Local temporary file "${fileUrl}" permanently wiped.`);
      }
    }

    // 3. Mark Firestore order as wiped for customer privacy
    if (orderId) {
      try {
        await updateOrderStatusInCloud(orderId, {
          fileUrl: 'WIPED_FOR_PRIVACY',
          printStatus: 'PRINTED'
        });
      } catch (err) {
        console.warn('Could not update order status in Firestore:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document permanently wiped from storage for customer privacy',
      wiped
    });
  } catch (error: any) {
    console.error('Delete handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to wipe document' },
      { status: 500 }
    );
  }
}
