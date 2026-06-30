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

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = packageJson.version;
console.log(`Building version: ${version}`);

// Copy and update manifest.json with version from package.json
const manifestSrc = path.join(__dirname, '..', 'src', 'manifest.json');
const manifestDest = path.join(distDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestSrc, 'utf8'));
manifest.name = packageJson.name;
manifest.description = packageJson.description;
manifest.version = version;
fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
console.log(`Copied: ${manifestSrc} -> ${manifestDest} (version: ${version})`);

// Copy panel.css
copyFileSync(
    path.join(__dirname, '..', 'src', 'panel.css'),
    path.join(distDir, 'panel.css')
);

// Copy VariableInputModal.css
copyFileSync(
    path.join(__dirname, '..', 'src', 'components', 'modals', 'VariableInputModal.css'),
    path.join(distDir, 'VariableInputModal.css')
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
