// Génère toutes les icônes à partir de public/icon-source.svg : `npm run icons`
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const p = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const source = readFileSync(p('icon-source.svg'), 'utf8');

// Favicon / onglet : version aux coins arrondis
writeFileSync(p('icon.svg'), source.replace('<rect width="200" height="200" ', '<rect width="200" height="200" rx="45" '));

// iPhone (écran d'accueil) : carré plein, iOS arrondit lui-même les coins
await sharp(Buffer.from(source)).resize(180, 180).png().toFile(p('apple-touch-icon.png'));
// Manifeste PWA
await sharp(Buffer.from(source)).resize(192, 192).png().toFile(p('icon-192.png'));
await sharp(Buffer.from(source)).resize(512, 512).png().toFile(p('icon-512.png'));
// Android « maskable » : le dessin garde une marge de sécurité
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#29465D' } })
  .composite([{ input: await sharp(Buffer.from(source)).resize(420, 420).png().toBuffer(), top: 46, left: 46 }])
  .png()
  .toFile(p('icon-512-maskable.png'));

console.log('Icônes générées dans public/');
