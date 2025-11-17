import ImageKit from 'imagekit';
import { env } from '../config/env.js';

class ImageKitService {
  private imagekit: ImageKit | null = null;
  private isTestMode: boolean;

  constructor() {
    this.isTestMode = process.env.NODE_ENV === 'test';
    
    // Only initialize ImageKit if we have the required keys (or not in test mode)
    if (!this.isTestMode || (env.imagekit.publicKey && env.imagekit.privateKey && env.imagekit.endpoint)) {
      try {
        this.imagekit = new ImageKit({
          publicKey: env.imagekit.publicKey || 'test-public-key',
          privateKey: env.imagekit.privateKey || 'test-private-key',
          urlEndpoint: env.imagekit.endpoint || 'https://test.imagekit.io',
        });
      } catch (error) {
        // In test mode, allow initialization to fail silently
        if (!this.isTestMode) {
          throw error;
        }
      }
    }
  }

  async uploadFile(
    file: Buffer,
    fileName: string,
    folder: string = 'properties'
  ): Promise<{ url: string; fileId: string; name: string }> {
    // In test mode, return mock response
    if (this.isTestMode && !this.imagekit) {
      console.log('📸 [TEST] ImageKit upload would be called:', fileName);
      return {
        url: `https://test.imagekit.io/${folder}/${fileName}`,
        fileId: 'test-file-id',
        name: fileName,
      };
    }

    if (!this.imagekit) {
      throw new Error('ImageKit not initialized');
    }

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
    // In test mode, return mock response
    if (this.isTestMode && !this.imagekit) {
      console.log('📸 [TEST] ImageKit delete would be called:', fileId);
      return;
    }

    if (!this.imagekit) {
      throw new Error('ImageKit not initialized');
    }

    try {
      await this.imagekit.deleteFile(fileId);
    } catch (error) {
      console.error('ImageKit delete error:', error);
      throw new Error('Failed to delete image from ImageKit');
    }
  }

  async listFiles(folder: string = 'properties'): Promise<any[]> {
    // In test mode, return mock response
    if (this.isTestMode && !this.imagekit) {
      console.log('📸 [TEST] ImageKit listFiles would be called:', folder);
      return [];
    }

    if (!this.imagekit) {
      throw new Error('ImageKit not initialized');
    }

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
