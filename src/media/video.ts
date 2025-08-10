import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import tmp from 'tmp';
import { promisify } from 'util';
import { config } from '../config.js';
import { computeImageHashes, HashResult } from './hashing.js';
import { Media, Flag } from '../schema.js';
import { AWSRekognitionProvider } from '../providers/vision/awsRekognition.js';
import { saveMediaHash } from '../data/supabase.js';

// Set ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface VideoModerationResult {
  hashes: HashResult[];
  flags: Flag[];
  duplicateHashes?: string[];
  duplicateDistances?: number[];
  frameCount: number;
}

export interface Keyframe {
  index: number;
  timestamp: number;
  hash: HashResult;
}

/**
 * Extract keyframes from video and compute hashes
 */
export async function moderateVideo(
  media: Media,
  existingHashes?: string[]
): Promise<VideoModerationResult> {
  const flags: Flag[] = [];
  const keyframes: Keyframe[] = [];
  const duplicateHashes: string[] = [];
  const duplicateDistances: number[] = [];

  try {
    // Extract keyframes
    const extractedFrames = await extractKeyframes(media.url);

    // Compute hashes for each keyframe
    for (const frame of extractedFrames) {
      const hash = await computeImageHashes(frame.buffer);
      keyframes.push({
        index: frame.index,
        timestamp: frame.timestamp,
        hash,
      });

      // Check for duplicates
      if (existingHashes && existingHashes.length > 0) {
        for (const existingHash of existingHashes) {
          const distance = computeSimilarity(hash.pHash, existingHash);
          if (distance >= (1 - config.thresholds.duplicate) * 100) {
            duplicateHashes.push(existingHash);
            duplicateDistances.push(distance);
            flags.push({
              source: 'metadata',
              category: 'duplicate',
              weight: 20,
              message: `Duplicate video frame detected (${distance.toFixed(1)}% similarity)`,
              mediaHash: hash.pHash,
              frameIndex: frame.index,
              confidence: distance / 100,
            });
          }
        }
      }

      // Save hash to Supabase if enabled
      if (config.enableSupabase) {
        try {
          await saveMediaHash({
            hash: hash.pHash,
            type: 'video',
            url: media.url,
          });
        } catch (error) {
          console.warn('Failed to save media hash:', error);
        }
      }
    }

    // Call vision providers for each keyframe if enabled
    if (config.enableRekognition) {
      const visionFlags = await moderateVideoWithVision(extractedFrames);
      flags.push(...visionFlags);
    }

    return {
      hashes: keyframes.map((k) => k.hash),
      flags,
      duplicateHashes: duplicateHashes.length > 0 ? duplicateHashes : undefined,
      duplicateDistances:
        duplicateDistances.length > 0 ? duplicateDistances : undefined,
      frameCount: keyframes.length,
    };
  } catch (error) {
    // Be resilient in offline/test environments: return empty flags instead of throwing
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('Video moderation skipped due to error:', msg);
    return { hashes: [], flags: [], frameCount: 0 };
  }
}

/**
 * Extract keyframes from video using ffmpeg
 */
async function extractKeyframes(
  videoUrl: string
): Promise<Array<{ index: number; timestamp: number; buffer: Buffer }>> {
  const createTempDir = promisify(tmp.dir);
  const tempDir = await createTempDir();
  const fs = await import('fs/promises');
  const path = await import('path');

  return new Promise((resolve, reject) => {
    const frames: Array<{ index: number; timestamp: number; buffer: Buffer }> =
      [];
    let frameIndex = 0;

    ffmpeg(videoUrl)
      .outputOptions([
        '-vf',
        'select=eq(pict_type\\,I)', // Extract I-frames (keyframes)
        '-vsync',
        'vfr', // Variable frame rate
        '-frame_pts',
        '1', // Include presentation timestamp
        '-q:v',
        '2', // High quality
        '-frames:v',
        '9', // Limit to 9 frames max
      ])
      .on('end', async () => {
        try {
          // Read the extracted frame files
          const files = await fs.readdir(tempDir);
          const frameFiles = files
            .filter((file) => file.endsWith('.jpg'))
            .sort((a, b) => {
              const numA = parseInt(a.match(/frame_(\d+)\.jpg/)?.[1] || '0');
              const numB = parseInt(b.match(/frame_(\d+)\.jpg/)?.[1] || '0');
              return numA - numB;
            });

          for (const frameFile of frameFiles) {
            const framePath = path.join(tempDir, frameFile);
            const buffer = await fs.readFile(framePath);
            const timestamp = frameIndex * 2; // Approximate timestamp

            frames.push({
              index: frameIndex++,
              timestamp,
              buffer,
            });
          }

          // Clean up temp directory
          await fs.rm(tempDir, { recursive: true, force: true });
          resolve(frames);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          reject(new Error(`Failed to read frame files: ${msg}`));
        }
      })
      .on('error', (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        reject(new Error(`FFmpeg error: ${msg}`));
      })
      .save(`${tempDir}/frame_%d.jpg`);
  });
}

/**
 * Moderate video frames using vision providers
 */
async function moderateVideoWithVision(
  frames: Array<{ index: number; timestamp: number; buffer: Buffer }>
): Promise<Flag[]> {
  const flags: Flag[] = [];

  // Sample frames for moderation (max 9 frames to avoid excessive API calls)
  const sampleSize = Math.min(frames.length, 9);
  const step = Math.max(1, Math.floor(frames.length / sampleSize));

  for (let i = 0; i < frames.length && i < sampleSize * step; i += step) {
    const frame = frames[i];

    try {
      const visionProvider = new AWSRekognitionProvider();
      if (visionProvider.isEnabled()) {
        const visionResult = await visionProvider.moderateImage(frame.buffer);
        if (visionResult.enabled && visionResult.categories) {
          for (const [category, result] of Object.entries(
            visionResult.categories
          )) {
            if (result.confidence > 0.5) {
              flags.push({
                source: 'vision',
                category: category,
                weight: Math.round(result.confidence * 50),
                message: `Vision detection at ${frame.timestamp.toFixed(2)}s: ${result.label} (${(result.confidence * 100).toFixed(1)}%)`,
                confidence: result.confidence,
                provider: 'aws-rekognition',
                frameIndex: frame.index,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Vision provider failed for frame ${frame.index}:`, error);
    }
  }

  return flags;
}

/**
 * Compute similarity between two hashes
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
