const path = require('path');
const fs = require('fs');
const rspack = require('@rspack/core');

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
const distDir = path.resolve(__dirname, 'dist');

class ManifestPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapPromise('ManifestPlugin', async (compilation) => {
      const manifestSrc = fs.readFileSync(path.resolve(__dirname, 'src', 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestSrc);
      manifest.name = pkg.name;
      manifest.description = pkg.description;
      manifest.version = pkg.version;
      compilation.emitAsset('manifest.json', new compiler.webpack.sources.RawSource(JSON.stringify(manifest, null, 2)));
    });
  }
}

const moduleRules = [
  {
    test: /\.tsx?$/,
    exclude: [/node_modules/],
    loader: 'builtin:swc-loader',
    options: {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
      },
    },
  },
  {
    test: /\.md$/,
    type: 'asset/source',
  },
  {
    test: /\.css$/,
    type: 'css/auto',
  },
];

const resolveConfig = {
  extensions: ['.tsx', '.ts', '.jsx', '.js'],
};

const copyPatterns = [
  { from: 'src/settings.html', to: 'settings.html' },
  { from: 'src/components/PromptPanel/PromptPanel.css', to: 'PromptPanel.css' },
  { from: 'src/components/modals/VariableInputModal.css', to: 'VariableInputModal.css' },
  { from: 'src/icons', to: 'icons' },
];

module.exports = [
  {
    name: 'background',
    entry: './src/background.ts',
    target: 'webworker',
    output: {
      path: distDir,
      filename: 'background.js',
      module: true,
    },
    experiments: {
      outputModule: true,
    },
    resolve: resolveConfig,
    module: { rules: moduleRules },
  },
  {
    name: 'content',
    entry: './src/content.ts',
    target: 'web',
    output: {
      path: distDir,
      filename: 'content.js',
    },
    resolve: resolveConfig,
    module: { rules: moduleRules },
  },
  {
    name: 'settings',
    entry: './src/SettingsApp.tsx',
    target: 'web',
    output: {
      path: distDir,
      filename: 'settings.js',
    },
    resolve: resolveConfig,
    module: { rules: moduleRules },
  },
  {
    name: 'assets',
    entry: {},
    output: { path: distDir, filename: '.noop.js' },
    plugins: [
      new rspack.CopyRspackPlugin({ patterns: copyPatterns }),
      new ManifestPlugin(),
    ],
  },
];
