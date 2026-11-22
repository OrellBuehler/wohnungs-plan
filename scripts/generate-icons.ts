import sharp from 'sharp';
import { readFileSync } from 'fs';

const sizes = [192, 512];
const svgPath = 'static/icon.svg';
const svg = readFileSync(svgPath);
const brand = '#0058be';

for (const size of sizes) {
	await sharp(svg).resize(size, size).png().toFile(`static/icon-${size}.png`);
	console.log(`Generated icon-${size}.png`);

	await sharp(svg)
		.resize(size, size)
		.flatten({ background: brand })
		.png()
		.toFile(`static/icon-maskable-${size}.png`);
	console.log(`Generated icon-maskable-${size}.png`);
}

// Also generate apple-touch-icon (180x180), full bleed because iOS fills transparency with black
await sharp(svg)
	.resize(180, 180)
	.flatten({ background: brand })
	.png()
	.toFile('static/apple-touch-icon.png');
console.log('Generated apple-touch-icon.png');

// Generate og-image (1200x630) with the icon centered
const ogWidth = 1200;
const ogHeight = 630;
const iconSize = 400;

const iconBuffer = await sharp(svg).resize(iconSize, iconSize).png().toBuffer();

await sharp({
	create: {
		width: ogWidth,
		height: ogHeight,
		channels: 4,
		background: { r: 247, g: 249, b: 251, alpha: 1 }
	}
})
	.composite([
		{
			input: iconBuffer,
			left: Math.floor((ogWidth - iconSize) / 2),
			top: Math.floor((ogHeight - iconSize) / 2)
		}
	])
	.png()
	.toFile('static/og-image.png');
console.log('Generated og-image.png');
