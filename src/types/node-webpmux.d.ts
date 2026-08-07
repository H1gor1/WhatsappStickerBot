declare module 'node-webpmux' {
  export class Image {
    constructor();
    initLib(): Promise<void>;
    load(path: string): Promise<void>;
    getImageData(): Promise<{ width: number; height: number }>;
    exif: Buffer;
    save(path: string | null): Promise<Buffer>;
  }
  const WebPMux: { Image: typeof Image };
  export default WebPMux;
}
