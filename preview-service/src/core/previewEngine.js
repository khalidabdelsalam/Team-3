const sharp = require('sharp');

const WIDTH  = parseInt(process.env.THUMBNAIL_WIDTH  || '256');
const HEIGHT = parseInt(process.env.THUMBNAIL_HEIGHT || '256');

/**
 * Core Logic: Preview Engine
 * Generates PNG thumbnails from raw file bytes using Sharp.
 * Similar to how Google Drive and Dropbox generate previews server-side.
 */
async function generate(rawBytes, mimeType = '') {
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/')) {
    return generateFromImage(rawBytes);
  }

  // Fallback: coloured placeholder PNG
  return generatePlaceholder(mime);
}

async function generateFromImage(rawBytes) {
  const png = await sharp(rawBytes)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 6 })
    .toBuffer();
  console.log(`[PreviewEngine] Image thumbnail generated (${WIDTH}x${HEIGHT})`);
  return png;
}

async function generatePlaceholder(mimeType) {
  // Generate a solid-colour PNG as placeholder for unsupported types
  const colors = {
    'application/pdf': { r: 220, g: 53,  b: 69  },
    'text/plain':      { r: 108, g: 117, b: 125 },
    'text/csv':        { r: 40,  g: 167, b: 69  },
    'application/json':{ r: 255, g: 193, b: 7   },
  };
  const bg = colors[mimeType] || { r: 13, g: 110, b: 253 };

  const png = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: bg }
  }).png().toBuffer();

  console.log(`[PreviewEngine] Placeholder generated for ${mimeType}`);
  return png;
}

module.exports = { generate };
