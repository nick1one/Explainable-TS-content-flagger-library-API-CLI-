import sharp from 'sharp';

export interface HashResult {
  pHash: string;
  dHash: string;
  width: number;
  height: number;
}

export interface HashComparison {
  pHashDistance: number;
  dHashDistance: number;
  minDistance: number;
  isDuplicate: boolean;
}

/**
 * Compute perceptual hash (pHash) and difference hash (dHash) for an image
 */
export async function computeImageHashes(
  imageBuffer: Buffer
): Promise<HashResult> {
  try {
    // Resize to 8x8 for consistent hashing (64 bits)
    const resized = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    // Compute simple perceptual hash based on average intensity
    const avgIntensity =
      resized.reduce((sum, pixel) => sum + pixel, 0) / resized.length;

    // Create pHash: 1 if pixel > average, 0 otherwise
    let pHash = '';
    for (let i = 0; i < resized.length; i++) {
      pHash += resized[i] > avgIntensity ? '1' : '0';
    }

    // Compute dHash (difference hash) - compare adjacent pixels
    let dHash = '';
    for (let i = 0; i < resized.length; i++) {
      if (i % 8 !== 7) {
        // Not last column
        dHash += resized[i] > resized[i + 1] ? '1' : '0';
      }
    }
    // Pad to 64 bits
    while (dHash.length < 64) {
      dHash += '0';
    }

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    return {
      pHash,
      dHash,
      width,
      height,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to compute image hashes: ${msg}`);
  }
}

/**
 * Compute Hamming distance between two hash strings
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash lengths must be equal');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Compare two hash results and determine if they're duplicates
 */
export function compareHashes(
  hash1: HashResult,
  hash2: HashResult,
  threshold: number = 0.15
): HashComparison {
  const pHashDistance = hammingDistance(hash1.pHash, hash2.pHash);
  const dHashDistance = hammingDistance(hash1.dHash, hash2.dHash);

  // Normalize distances by hash length
  const normalizedPHashDistance = pHashDistance / hash1.pHash.length;
  const normalizedDHashDistance = dHashDistance / hash1.dHash.length;

  const minDistance = Math.min(
    normalizedPHashDistance,
    normalizedDHashDistance
  );
  const isDuplicate = minDistance <= threshold;

  return {
    pHashDistance: normalizedPHashDistance,
    dHashDistance: normalizedDHashDistance,
    minDistance,
    isDuplicate,
  };
}

/**
 * Convert hash string to binary for more precise distance calculation
 */
export function hashToBinary(hash: string): string {
  return hash
    .split('')
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

/**
 * Compute similarity percentage between two hashes
 */
export function computeSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  const maxDistance = hash1.length;
  return ((maxDistance - distance) / maxDistance) * 100;
}
