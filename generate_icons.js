const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type 2 (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw Image Data (Scanlines)
  const lineLength = width * 3 + 1;
  const rawData = Buffer.alloc(height * lineLength);

  for (let y = 0; y < height; y++) {
    const offset = y * lineLength;
    rawData[offset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 3;
      // Gradient effect
      const factor = (x + y) / (width + height);
      rawData[pxOffset] = Math.min(255, Math.floor(r * (1 - factor * 0.3)));
      rawData[pxOffset + 1] = Math.min(255, Math.floor(g * (1 - factor * 0.3)));
      rawData[pxOffset + 2] = Math.min(255, Math.floor(b + factor * 50));
    }
  }

  // IDAT Chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crc = crc32(buf.slice(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'icon16.png'), createPNG(16, 16, 99, 102, 241));
fs.writeFileSync(path.join(dir, 'icon48.png'), createPNG(48, 48, 99, 102, 241));
fs.writeFileSync(path.join(dir, 'icon128.png'), createPNG(128, 128, 99, 102, 241));

console.log('Successfully generated extension icons: icon16.png, icon48.png, icon128.png');
