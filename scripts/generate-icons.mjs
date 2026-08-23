// Erzeugt PNG-App-Icons aus static/icon.svg — für iOS-Homescreen (apple-touch-icon
// braucht zwingend PNG) und die PWA-Manifest-Icons. Bei Bedarf erneut ausführen:
//   node scripts/generate-icons.mjs
import sharp from 'sharp';
import path from 'node:path';

const src = path.resolve('static/icon.svg');
const sizes = [
	{ size: 180, out: 'apple-touch-icon.png' }, // iOS-Homescreen
	{ size: 192, out: 'icon-192.png' }, // Manifest "any"
	{ size: 512, out: 'icon-512.png' } // Manifest "any"
];

for (const { size, out } of sizes) {
	await sharp(src, { density: 384 })
		.resize(size, size)
		.png()
		.toFile(path.resolve('static', out));
	console.log(`✓ static/${out} (${size}×${size})`);
}
