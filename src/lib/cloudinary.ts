import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'apfaipyz',
  api_key: process.env.CLOUDINARY_API_KEY || '288824881539877',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'FmgzP4jHN7MaOQ1lvOYrK9IMgGU',
  secure: true
});

/**
 * Upload PDF or raw document buffer directly to Cloudinary
 */
export async function uploadRawFileToCloudinary(
  buffer: Buffer,
  fileName: string,
  folder: string = 'pageprint'
): Promise<{ secure_url: string; public_id: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    // Sanitize filename for public_id
    const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const publicId = `${folder}/${Date.now()}_${safeName}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw', // 'raw' preserves PDF binary integrity exactly
        public_id: publicId,
        folder: folder,
        use_filename: true,
        unique_filename: false,
        overwrite: true
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          return reject(error || new Error('Upload to Cloudinary failed with empty result'));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          bytes: result.bytes
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Instantly wipe document from Cloudinary (called within seconds of physical print)
 */
export async function deleteRawFileFromCloudinary(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    return false;
  }
}

export default cloudinary;
