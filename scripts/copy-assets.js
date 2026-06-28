const fs = require('fs');
const path = require('path');

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

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy manifest.json
copyFileSync(
    path.join(__dirname, '..', 'src', 'manifest.json'),
    path.join(distDir, 'manifest.json')
);

// Copy panel.css
copyFileSync(
    path.join(__dirname, '..', 'src', 'panel.css'),
    path.join(distDir, 'panel.css')
);

// Copy settings.html
copyFileSync(
    path.join(__dirname, '..', 'src', 'settings.html'),
    path.join(distDir, 'settings.html')
);

// Copy icons directory
copyDirSync(
    path.join(__dirname, '..', 'src', 'icons'),
    path.join(distDir, 'icons')
);

console.log('Assets copied successfully!');
