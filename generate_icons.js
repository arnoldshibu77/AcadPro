const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Colors
// #1617c6 -> RGB(22, 23, 198)
// #ddff6c -> RGB(221, 255, 108)

function createAcadProPNG(size) {
  const width = size;
  const height = size;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type 6: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const lineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * lineLength);

  const bgR = 22, bgG = 23, bgB = 198;
  const limeR = 221, limeG = 255, limeB = 108;

  for (let y = 0; y < height; y++) {
    const offset = y * lineLength;
    rawData[offset] = 0; // Filter 0

    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 4;

      // Center coords (-1 to 1)
      const cx = (x - width / 2) / (width / 2);
      const cy = (y - height / 2) / (height / 2);

      // Default background #1617c6
      let r = bgR;
      let g = bgG;
      let b = bgB;
      let a = 255;

      // Rounded square icon boundary (lime #ddff6c)
      const sizeMargin = 0.65;
      const cornerRadius = 0.25;

      const dx = Math.max(0, Math.abs(cx) - (sizeMargin - cornerRadius));
      const dy = Math.max(0, Math.abs(cy) - (sizeMargin - cornerRadius));
      const inLimeBox = (dx * dx + dy * dy) <= (cornerRadius * cornerRadius);

      if (inLimeBox) {
        // Star / Asterisk inside lime box (blue #1617c6)
        const dist = Math.sqrt(cx * cx + cy * cy);
        const angle = Math.atan2(cy, cx);
        
        // 6-petal star math: r = r0 + r1 * cos(6 * angle)
        const petalRadius = 0.38 + 0.12 * Math.cos(6 * angle);

        if (dist <= petalRadius && dist > 0.05) {
          r = bgR;
          g = bgG;
          b = bgB;
        } else {
          r = limeR;
          g = limeG;
          b = limeB;
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
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
fs.writeFileSync(path.join(dir, 'icon16.png'), createAcadProPNG(16));
fs.writeFileSync(path.join(dir, 'icon48.png'), createAcadProPNG(48));
fs.writeFileSync(path.join(dir, 'icon128.png'), createAcadProPNG(128));

console.log('Successfully generated official AcadPro theme icons: icon16.png, icon48.png, icon128.png');
