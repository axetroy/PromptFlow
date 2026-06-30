const esbuild = require('esbuild');
const path = require('path');

async function build() {
    const commonOptions = {
        bundle: true,
        minify: false,
        sourcemap: false,
        target: 'es2020',
        platform: 'browser',
        jsx: 'automatic',
        jsxImportSource: 'react',
        loader: {
            '.tsx': 'tsx',
            '.ts': 'ts',
            '.css': 'css',
            '.md': 'text',
        },
    };

    // Bundle background script (ESM for service worker)
    await esbuild.build({
        ...commonOptions,
        entryPoints: [path.join(__dirname, '..', 'src', 'background.ts')],
        outfile: path.join(__dirname, '..', 'dist', 'background.js'),
        format: 'esm',
        jsx: undefined,
        jsxImportSource: undefined,
    });

    // Bundle content script (IIFE for content scripts) - includes React for VariableInputModal
    await esbuild.build({
        ...commonOptions,
        entryPoints: [path.join(__dirname, '..', 'src', 'content.ts')],
        outfile: path.join(__dirname, '..', 'dist', 'content.js'),
        format: 'iife',
        jsx: undefined,
        jsxImportSource: undefined,
        // Define React and ReactDOM as globals for content script
        define: {
            'process.env.NODE_ENV': '"production"',
        },
    });

    // Bundle settings React app with Ant Design (IIFE for popup page)
    await esbuild.build({
        ...commonOptions,
        entryPoints: [path.join(__dirname, '..', 'src', 'SettingsApp.tsx')],
        outfile: path.join(__dirname, '..', 'dist', 'settings.js'),
        format: 'iife',
    });

    console.log('Build completed successfully!');
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
