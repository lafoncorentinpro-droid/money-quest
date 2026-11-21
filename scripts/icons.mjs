// Génère les icônes PNG de la PWA à partir de public/icon.svg : `npm run icons`
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));
// iOS n'arrondit pas lui-même la transparence : fond plein, sans coins
const flat = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'));
await sharp(flat).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
// Icône « maskable » (Android) : marge de sécurité
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#DCEBF5' } })
  .composite([{ input: await sharp(flat).resize(400, 400).png().toBuffer(), top: 56, left: 56 }])
  .png()
  .toFile(out('icon-512-maskable.png'));
console.log('Icônes générées dans public/');
