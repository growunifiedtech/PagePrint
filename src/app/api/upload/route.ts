import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { uploadRawFileToCloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const shopId = (formData.get('shopId') as string) || 'general';
    const orderId = (formData.get('orderId') as string) || Date.now().toString();

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided in form data' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Try Cloudinary 25 GB Vault First (Production Cloud)
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const cloudResult = await uploadRawFileToCloudinary(buffer, file.name, `pageprint/${shopId}`);
        return NextResponse.json({
          success: true,
          fileUrl: cloudResult.secure_url,
          publicId: cloudResult.public_id,
          provider: 'cloudinary',
          fileName: file.name,
          size: cloudResult.bytes
        });
      } catch (cloudErr: any) {
        console.warn('Cloudinary upload error, falling back to server disk:', cloudErr.message);
      }
    }

    // 2. Fallback to Server Disk (Local Development)
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', shopId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFileName = `${orderId}_${safeName}`;
    const targetPath = path.join(uploadsDir, storedFileName);

    fs.writeFileSync(targetPath, buffer);
    const fileUrl = `/uploads/${shopId}/${storedFileName}`;

    return NextResponse.json({
      success: true,
      fileUrl,
      publicId: `local_${storedFileName}`,
      provider: 'local',
      fileName: file.name,
      size: buffer.length
    });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process file upload' },
      { status: 500 }
    );
  }
}
