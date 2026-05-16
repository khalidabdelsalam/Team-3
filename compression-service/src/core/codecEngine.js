const zlib = require('zlib');
const { promisify } = require('util');

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Core Logic: Codec Engine
 * Compresses/decompresses buffers using gzip (Node built-in) or zstd.
 * Similar to Netflix's use of zstd for metadata and AWS S3 gzip transfer encoding.
 */

async function compress(buffer, algorithm = 'gzip') {
  const start = Date.now();
  let compressed;

  if (algorithm === 'gzip') {
    compressed = await gzip(buffer, { level: 6 });
  } else if (algorithm === 'zstd') {
    // zstd via gzip fallback if native not available
    try {
      const { compress: zstdCompress } = require('@mongodb-js/zstd');
      compressed = await zstdCompress(buffer);
    } catch {
      console.warn('[CodecEngine] zstd unavailable, falling back to gzip');
      compressed = await gzip(buffer, { level: 6 });
    }
  } else {
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const ratio         = parseFloat((compressed.length / buffer.length).toFixed(4));
  const durationMs    = Date.now() - start;
  const originalSize  = buffer.length;
  const compressedSize= compressed.length;

  console.log(
    `[CodecEngine] Compressed ${originalSize}B → ${compressedSize}B ` +
    `ratio=${ratio} algorithm=${algorithm} time=${durationMs}ms`
  );

  return { compressed, ratio, originalSize, compressedSize, durationMs };
}

async function decompress(buffer, algorithm = 'gzip') {
  if (algorithm === 'gzip') {
    const raw = await gunzip(buffer);
    console.log(`[CodecEngine] Decompressed ${buffer.length}B → ${raw.length}B`);
    return raw;
  } else if (algorithm === 'zstd') {
    try {
      const { decompress: zstdDecompress } = require('@mongodb-js/zstd');
      return await zstdDecompress(buffer);
    } catch {
      throw new Error('zstd decompression unavailable');
    }
  }
  throw new Error(`Unsupported algorithm: ${algorithm}`);
}

function detectAlgorithm(buffer) {
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) return 'gzip';
  if (buffer[0] === 0x28 && buffer[1] === 0xb5) return 'zstd';
  return 'gzip';
}

module.exports = { compress, decompress, detectAlgorithm };
