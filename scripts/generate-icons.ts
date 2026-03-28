import sharp from 'sharp';
import { readFileSync } from 'fs';

const sizes = [192, 512];
const svgPath = 'static/icon.svg';
const svg = readFileSync(svgPath);

for (const size of sizes) {
	await sharp(svg).resize(size, size).png().toFile(`static/icon-${size}.png`);
	console.log(`Generated icon-${size}.png`);
}

// Also generate apple-touch-icon (180x180)
await sharp(svg).resize(180, 180).png().toFile('static/apple-touch-icon.png');
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
		background: { r: 241, g: 245, b: 249, alpha: 1 } // slate-100
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
