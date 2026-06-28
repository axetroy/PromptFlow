const esbuild = require('esbuild');
const path = require('path');

async function build() {
    const commonOptions = {
        bundle: true,
        minify: false,
        sourcemap: false,
        target: 'es2020',
        platform: 'browser',
        loader: {
            '.tsx': 'tsx',
            '.ts': 'ts',
        },
    };

    // Bundle background script (ESM for service worker)
    await esbuild.build({
        ...commonOptions,
        entryPoints: [path.join(__dirname, '..', 'src', 'background.ts')],
        outfile: path.join(__dirname, '..', 'dist', 'background.js'),
        format: 'esm',
    });

    // Bundle content script (IIFE for content scripts)
    await esbuild.build({
        ...commonOptions,
        entryPoints: [path.join(__dirname, '..', 'src', 'content.ts')],
        outfile: path.join(__dirname, '..', 'dist', 'content.js'),
        format: 'iife',
    });

    // Bundle settings React app (IIFE for popup page with React)
    await esbuild.build({
        ...commonOptions,
        entryPoints: [path.join(__dirname, '..', 'src', 'SettingsApp.tsx')],
        outfile: path.join(__dirname, '..', 'dist', 'settings.js'),
        format: 'iife',
        jsx: 'automatic',
        jsxImportSource: 'react',
    });

    console.log('Build completed successfully!');
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
