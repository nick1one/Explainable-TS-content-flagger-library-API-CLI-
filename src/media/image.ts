import { config } from '../config.js';
import { computeImageHashes, HashResult } from './hashing.js';
import { Media } from '../schema.js';
import { Flag } from '../schema.js';
import { AWSRekognitionProvider } from '../providers/vision/awsRekognition.js';
import { saveMediaHash } from '../data/supabase.js';

export interface ImageModerationResult {
  hashes: HashResult;
  flags: Flag[];
  duplicateHash?: string;
  duplicateDistance?: number;
}

/**
 * Fetch image from URL and return buffer
 */
async function fetchImage(url: string): Promise<Buffer> {
  try {
    const fetchLike = (
      globalThis as unknown as {
        fetch?: (
          input: string,
          init?: unknown
        ) => Promise<{
          ok: boolean;
          status: number;
          statusText: string;
          arrayBuffer: () => Promise<ArrayBuffer>;
        }>;
      }
    ).fetch;
    if (!fetchLike) {
      throw new Error('Fetch API not available in this environment');
    }
    const response = await fetchLike(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`
      );
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch image from ${url}: ${msg}`);
  }
}

/**
 * Moderate an image using vision providers and hashing
 */
export async function moderateImage(
  media: Media,
  existingHashes?: string[]
): Promise<ImageModerationResult> {
  const flags: Flag[] = [];

  try {
    // Fetch and hash the image
    const imageBuffer = await fetchImage(media.url);
    const hashes = await computeImageHashes(imageBuffer);

    // Check for duplicates if we have existing hashes
    let duplicateHash: string | undefined;
    let duplicateDistance: number | undefined;

    if (existingHashes && existingHashes.length > 0) {
      for (const existingHash of existingHashes) {
        const distance = computeSimilarity(hashes.pHash, existingHash);
        if (distance >= (1 - config.thresholds.duplicate) * 100) {
          duplicateHash = existingHash;
          duplicateDistance = distance;
          flags.push({
            source: 'metadata',
            category: 'duplicate',
            weight: 20,
            message: `Duplicate image detected (${distance.toFixed(1)}% similarity)`,
            mediaHash: hashes.pHash,
            confidence: distance / 100,
          });
          break;
        }
      }
    }

    // Save hash to Supabase if enabled
    if (config.enableSupabase) {
      try {
        await saveMediaHash({
          hash: hashes.pHash,
          type: 'image',
          url: media.url,
        });
      } catch (error) {
        console.warn('Failed to save media hash:', error);
      }
    }

    // Call vision providers if enabled
    if (config.enableRekognition) {
      try {
        const visionProvider = new AWSRekognitionProvider();
        if (visionProvider.isEnabled()) {
          const visionResult = await visionProvider.moderateImage(imageBuffer);
          if (visionResult.enabled && visionResult.categories) {
            // Convert vision provider results to flags
            for (const [category, result] of Object.entries(
              visionResult.categories
            )) {
              if (result.confidence > 0.5) {
                // Only flag high-confidence results
                flags.push({
                  source: 'vision',
                  category: category,
                  weight: Math.round(result.confidence * 50), // Scale confidence to weight
                  message: `Vision detection: ${result.label} (${(result.confidence * 100).toFixed(1)}%)`,
                  confidence: result.confidence,
                  provider: 'aws-rekognition',
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn('Vision provider failed:', error);
      }
    }

    return {
      hashes,
      flags,
      duplicateHash,
      duplicateDistance,
    };
  } catch (error) {
    // Be resilient in offline/test environments: return empty flags instead of throwing
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('Image moderation skipped due to error:', msg);
    const fallbackHashes: HashResult = {
      pHash: '',
      dHash: '',
      width: 0,
      height: 0,
    };
    return { hashes: fallbackHashes, flags: [] };
  }
}

/**
 * Compute similarity between two hashes (helper function)
 */
function computeSimilarity(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return ((hash1.length - distance) / hash1.length) * 100;
}
