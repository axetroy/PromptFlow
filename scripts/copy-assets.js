const fs = require('fs');
const path = require('path');

// Cross-platform file copy utility
function copyFileSync(src, dest) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
}

function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

// Ensure dist directory exists
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy manifest.json
const manifestSrc = path.join(__dirname, '..', 'src', 'manifest.json');
const manifestDest = path.join(distDir, 'manifest.json');
if (fs.existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, manifestDest);
}

// Copy panel.css
const cssSrc = path.join(__dirname, '..', 'src', 'panel.css');
const cssDest = path.join(distDir, 'panel.css');
if (fs.existsSync(cssSrc)) {
    copyFileSync(cssSrc, cssDest);
}

// Copy icons directory
const iconsSrc = path.join(__dirname, '..', 'src', 'icons');
const iconsDest = path.join(distDir, 'icons');
if (fs.existsSync(iconsSrc)) {
    copyDirSync(iconsSrc, iconsDest);
}

console.log('Assets copied successfully!');