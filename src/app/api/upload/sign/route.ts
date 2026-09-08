import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'apfaipyz';
const API_KEY = process.env.CLOUDINARY_API_KEY || '288824881539877';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'FmgzP4jHN7MaOQ1lvOYrK9IMgGU';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId') || 'general';
    const folder = `pageprint/${shopId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const timestamp = Math.round(Date.now() / 1000);

    // Cloudinary signed upload: parameters in alphabetical order
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    return NextResponse.json({
      success: true,
      cloudName: CLOUD_NAME,
      apiKey: API_KEY,
      timestamp,
      folder,
      signature
    });
  } catch (error: any) {
    console.error('Error generating upload signature:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate signature' },
      { status: 500 }
    );
  }
}
