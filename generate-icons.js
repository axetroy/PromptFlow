const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Simple PNG generator for solid color icons with rounded corners
function createPNG(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  function crc32(data) {
    let crc = 0xffffffff;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crc]);
  }
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  // Raw image data
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Rounded rectangle
      const cornerRadius = Math.floor(width * 0.2);
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      let inside = false;
      
      if (dx < cornerRadius && dy < cornerRadius) {
        const dist = Math.sqrt(Math.pow(cornerRadius - dx, 2) + Math.pow(cornerRadius - dy, 2));
        inside = dist <= cornerRadius;
      } else {
        inside = true;
      }
      
      if (inside) {
        raw.push(r, g, b);
      } else {
        raw.push(0, 0, 0); // transparent
      }
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(raw));
  
  // IEND
  const iend = Buffer.alloc(0);
  
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend)
  ]);
}

// Gradient-ish colors (indigo to purple)
const r1 = 99, g1 = 102, b1 = 241;  // #6366f1
const r2 = 139, g2 = 92, b2 = 246;   // #8b5cf6

// Create icons
const icons = [
  { size: 16, r: r1, g: g1, b: b1 },
  { size: 48, r: Math.round((r1 + r2) / 2), g: Math.round((g1 + g2) / 2), b: Math.round((b1 + b2) / 2) },
  { size: 128, r: r2, g: g2, b: b2 }
];

icons.forEach(({ size, r, g, b }) => {
  const png = createPNG(size, size, r, g, b);
  fs.writeFileSync(path.join(__dirname, 'dist', 'icons', `icon${size}.png`), png);
  console.log(`Created dist/icons/icon${size}.png`);
});
