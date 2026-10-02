const zlib = require('zlib');
const PNG = require('png-js');
const path = require('path');
const fs = require('fs');

function createCrcTable(): Uint32Array {
  const cTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    cTable[n] = c;
  }
  return cTable;
}

const crcTable = createCrcTable();

export function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const typeAndData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([lenBuf, typeAndData, crcBuf]);
}

export function encodeRgbaPng(
  width: number,
  height: number,
  rgbaBuffer: Buffer,
): Buffer {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type 6 = RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const scanlineLength = 1 + width * 4;
  const scanlines = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    scanlines[offset] = 0; // Filter type None
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(scanlines, offset + 1, srcOffset, srcOffset + width * 4);
  }

  const idatChunk = makeChunk('IDAT', zlib.deflateSync(scanlines));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

export async function removeWhiteBackground(fileBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve) => {
    try {
      const img = new PNG(fileBuffer);
      img.decode((pixels: Buffer) => {
        if (!pixels || pixels.length === 0) return resolve(fileBuffer);
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          if (r > 225 && g > 225 && b > 225) {
            pixels[i + 3] = 0;
          }
        }
        const transparentPng = encodeRgbaPng(img.width, img.height, pixels);
        resolve(transparentPng);
      });
    } catch {
      resolve(fileBuffer);
    }
  });
}

export async function normalizeDiagramImage(rawDiagram: string): Promise<string> {
  try {
    let fileBuffer: Buffer | null = null;
    let mimeType = 'image/png';

    if (rawDiagram.startsWith('data:image/')) {
      const match = rawDiagram.match(/^data:(image\/[a-zA-Z+.-]+);base64,/);
      if (match) {
        mimeType = match[1];
      }
      const base64Data = rawDiagram.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else {
      const diagramAbsPath = rawDiagram.startsWith('/')
        ? path.join(process.cwd(), rawDiagram.slice(1))
        : path.join(process.cwd(), rawDiagram);
      if (fs.existsSync(diagramAbsPath)) {
        fileBuffer = fs.readFileSync(diagramAbsPath);
        mimeType = rawDiagram.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      }
    }

    if (!fileBuffer || fileBuffer.length < 8) return rawDiagram;

    // Check if buffer starts with standard PNG signature (0x89 0x50 0x4e 0x47 0x0d 0x0a 0x1a 0x0a)
    const isPngSignature =
      fileBuffer[0] === 0x89 &&
      fileBuffer[1] === 0x50 &&
      fileBuffer[2] === 0x4e &&
      fileBuffer[3] === 0x47 &&
      fileBuffer[4] === 0x0d &&
      fileBuffer[5] === 0x0a &&
      fileBuffer[6] === 0x1a &&
      fileBuffer[7] === 0x0a;

    if (!isPngSignature) {
      if (rawDiagram.startsWith('data:image')) return rawDiagram;
      return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    }

    return await new Promise<string>((resolve) => {
      try {
        const img = new PNG(fileBuffer);
        img.decode((pixels: Buffer) => {
          if (!pixels || pixels.length === 0) {
            return resolve(rawDiagram.startsWith('data:') ? rawDiagram : `data:image/png;base64,${fileBuffer.toString('base64')}`);
          }

          // Composite any transparent alpha pixels onto a solid white background (255, 255, 255)
          for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3] / 255;
            if (alpha < 1) {
              pixels[i] = Math.round(pixels[i] * alpha + 255 * (1 - alpha));
              pixels[i + 1] = Math.round(pixels[i + 1] * alpha + 255 * (1 - alpha));
              pixels[i + 2] = Math.round(pixels[i + 2] * alpha + 255 * (1 - alpha));
              pixels[i + 3] = 255;
            }
          }

          const cleanPngBuf = encodeRgbaPng(img.width, img.height, pixels);
          resolve(`data:image/png;base64,${cleanPngBuf.toString('base64')}`);
        });
      } catch (err) {
        resolve(rawDiagram.startsWith('data:') ? rawDiagram : `data:image/png;base64,${fileBuffer.toString('base64')}`);
      }
    });
  } catch (err) {
    return rawDiagram;
  }
}
