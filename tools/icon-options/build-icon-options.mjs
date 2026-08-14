/* eslint-env node */

/**
 * Regenerates the options of every `icon` select field in blocks/<name>/_<name>.json
 * from the SVG files in /icons, so the editor's icon picker can never drift from
 * the icons the site actually ships.
 *
 * Run via `npm run build:icons` (also runs as part of `npm run build:json`).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const iconsDir = path.join(root, 'icons');
const blocksDir = path.join(root, 'blocks');

const toLabel = (name) => name
  .split('-')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

function readIconOptions() {
  const names = fs.readdirSync(iconsDir)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => path.basename(file, '.svg'))
    .sort();

  return [
    { name: 'No icon', value: '' },
    ...names.map((name) => ({ name: toLabel(name), value: name })),
  ];
}

function blockModelFiles() {
  return fs.readdirSync(blocksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(blocksDir, entry.name, `_${entry.name}.json`))
    .filter((file) => fs.existsSync(file));
}

function applyOptions(file, options) {
  const config = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let updated = false;

  (config.models || []).forEach((model) => {
    (model.fields || []).forEach((field) => {
      if (field.component === 'select' && field.name === 'icon') {
        field.options = options;
        updated = true;
      }
    });
  });

  if (updated) fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return updated;
}

const options = readIconOptions();
const updatedFiles = blockModelFiles().filter((file) => applyOptions(file, options));

/* eslint-disable no-console */
console.log(`icon picker: ${options.length - 1} icons -> ${updatedFiles.length} model file(s)`);
updatedFiles.forEach((file) => console.log(`  ${path.relative(root, file)}`));
