import ImageKit from 'imagekit';
import { env } from '../config/env.js';

class ImageKitService {
  private imagekit: ImageKit;

  constructor() {
    this.imagekit = new ImageKit({
      publicKey: env.imagekit.publicKey,
      privateKey: env.imagekit.privateKey,
      urlEndpoint: env.imagekit.endpoint,
    });
  }

  async uploadFile(
    file: Buffer,
    fileName: string,
    folder: string = 'properties'
  ): Promise<{ url: string; fileId: string; name: string }> {
    try {
      const uploadResponse = await this.imagekit.upload({
        file: file,
        fileName: fileName,
        folder: folder,
        useUniqueFileName: true,
        tags: ['property', 'letrents'],
      });

      return {
        url: uploadResponse.url,
        fileId: uploadResponse.fileId,
        name: uploadResponse.name,
      };
    } catch (error) {
      console.error('ImageKit upload error:', error);
      throw new Error('Failed to upload image to ImageKit');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.imagekit.deleteFile(fileId);
    } catch (error) {
      console.error('ImageKit delete error:', error);
      throw new Error('Failed to delete image from ImageKit');
    }
  }

  async listFiles(folder: string = 'properties'): Promise<any[]> {
    try {
      const response = await this.imagekit.listFiles({
        path: folder,
        limit: 100,
      });
      return response;
    } catch (error) {
      console.error('ImageKit list files error:', error);
      throw new Error('Failed to list files from ImageKit');
    }
  }
}

export const imagekitService = new ImageKitService();
