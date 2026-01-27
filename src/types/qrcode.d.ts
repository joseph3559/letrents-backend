// Type declarations for qrcode module
declare module 'qrcode' {
  interface QRCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    type?: 'image/png' | 'image/jpeg' | 'image/webp' | 'svg';
    quality?: number;
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  interface QRCode {
    toDataURL(data: string, options?: QRCodeOptions): Promise<string>;
    toString(data: string, options?: QRCodeOptions): Promise<string>;
  }

  const qrcode: QRCode;
  export default qrcode;
}
