/**
 * Script to generate PNG icons from SVG logo
 * 
 * Usage: node scripts/generate-icons.js
 * 
 * Requires: sharp (for image processing)
 * Install: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp module not found');
  console.error('Please run: npm install sharp');
  process.exit(1);
}

const SIZES = [16, 48, 128];

const ICONS_DIR = path.join(__dirname, '..', 'src', 'icons');
const SVG_PATH = path.join(__dirname, '..', 'icons', 'icon.svg');

async function generateIcons() {
  // Check if SVG exists
  if (!fs.existsSync(SVG_PATH)) {
    console.error(`Error: SVG file not found at ${SVG_PATH}`);
    process.exit(1);
  }

  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Read SVG
  const svgBuffer = fs.readFileSync(SVG_PATH);
  console.log(`Reading SVG from: ${SVG_PATH}`);

  // Generate icons for each size
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon${size}.png`);
    
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`Generated: icon${size}.png`);
    } catch (error) {
      console.error(`Error generating icon${size}.png:`, error.message);
    }
  }

  console.log('\nDone! Icons generated in src/icons/');
}

generateIcons().catch(console.error);
