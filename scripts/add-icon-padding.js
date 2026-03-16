/**
 * Generates an app icon with safe-zone padding so the logo isn't cut on
 * Android/iOS launchers. Uses Masterlogo.png and outputs Masterlogo-icon.png.
 *
 * Safe zone: center ~62% of canvas (Android adaptive icon safe zone ~66/108).
 * Run: node scripts/add-icon-padding.js
 */

const path = require('path');
const sharp = require('sharp');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const INPUT = path.join(ASSETS_DIR, 'Masterlogo.png');
const OUTPUT = path.join(ASSETS_DIR, 'Masterlogo-icon.png');
const SIZE = 1024;
const SAFE_SCALE = 0.62; // logo at 62% of canvas = ~19% padding each side (Android safe zone)
async function main() {
  const logoSize = Math.round(SIZE * SAFE_SCALE);
  const offset = Math.round((SIZE - logoSize) / 2);

  const resizedLogo = await sharp(INPUT)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Transparent canvas so padded area shows adaptive icon backgroundColor
  const background = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();

  await sharp(background)
    .composite([{ input: resizedLogo, left: offset, top: offset }])
    .png()
    .toFile(OUTPUT);

  console.log('Created', OUTPUT, `(${SIZE}x${SIZE}, logo at ${SAFE_SCALE * 100}% with padding)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
