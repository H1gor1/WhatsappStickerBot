import fs from 'node:fs/promises';
import { loadEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

const env = loadEnv();

function buildExifData(json: string): Buffer {
  const jsonBuffer = Buffer.from(json, 'utf-8');

  const header = Buffer.alloc(22);
  header.writeUInt16LE(0x4949, 0);  // "II" little-endian
  header.writeUInt16LE(0x002A, 2);  // TIFF magic 42
  header.writeUInt32LE(8, 4);       // offset to first IFD
  header.writeUInt16LE(1, 8);       // number of directory entries
  header.writeUInt16LE(0x5741, 10);  // tag 0x5741 (private)
  header.writeUInt16LE(7, 12);       // type = UNDEFINED
  header.writeUInt32LE(jsonBuffer.length, 14); // count = JSON length
  header.writeUInt32LE(22, 18);       // value offset = 22

  return Buffer.concat([header, jsonBuffer]);
}

function injectExifChunk(webpBuffer: Buffer, exifPayload: Buffer): Buffer {
  if (webpBuffer.toString('ascii', 8, 12) !== 'WEBP') {
    return webpBuffer;
  }

  const chunkTag = webpBuffer.toString('ascii', 12, 16);
  if (chunkTag !== 'VP8X') return webpBuffer;

  const vp8xSize = webpBuffer.readUInt32LE(16);
  const vp8xDataStart = 20;
  const vp8xDataEnd = vp8xDataStart + vp8xSize;

  const flags = webpBuffer.readUInt32LE(vp8xDataStart);
  const newFlags = flags | 0x08;
  const flagsBuf = Buffer.alloc(4);
  flagsBuf.writeUInt32LE(newFlags, 0);

  const exifTag = Buffer.from('EXIF', 'ascii');
  const exifChunkSize = Buffer.alloc(4);
  exifChunkSize.writeUInt32LE(exifPayload.length, 0);

  let chunk = Buffer.concat([exifTag, exifChunkSize, exifPayload]);
  if (exifPayload.length % 2 !== 0) {
    chunk = Buffer.concat([chunk, Buffer.alloc(1)]);
  }

  const riffSize = webpBuffer.readUInt32LE(4);
  const newRiffSize = riffSize + chunk.length;
  const newSizeBuf = Buffer.alloc(4);
  newSizeBuf.writeUInt32LE(newRiffSize, 0);

  return Buffer.concat([
    webpBuffer.subarray(0, 4),
    newSizeBuf,
    webpBuffer.subarray(8, vp8xDataStart),
    flagsBuf,
    webpBuffer.subarray(vp8xDataStart + 4, vp8xDataEnd),
    chunk,
    webpBuffer.subarray(vp8xDataEnd),
  ]);
}

export async function addStickerMetadata(webpPath: string): Promise<Buffer> {
  const webpBuffer = await fs.readFile(webpPath);

  const json = JSON.stringify({
    'sticker-pack-id': 'botfig',
    'sticker-pack-name': env.STICKER_PACK_NAME,
    'sticker-pack-publisher': env.STICKER_AUTHOR,
    'emojis': ['🙂'],
  });

  const exifPayload = buildExifData(json);
  const result = injectExifChunk(webpBuffer, exifPayload);

  await fs.writeFile(webpPath, result);

  logger.info({ webpPath, sizeKB: (result.length / 1024).toFixed(1) }, 'Metadados adicionados ao sticker');
  return result;
}
