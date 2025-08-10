import { config } from '../../config.js';
import {
  VisionProvider,
  VisionProviderConfig,
  mapVisionCategory,
} from './types.js';
import { VisionProviderResult } from '../../schema.js';

export class AWSRekognitionProvider implements VisionProvider {
  private config: VisionProviderConfig;

  constructor(providerConfig?: VisionProviderConfig) {
    this.config = {
      region: config.aws.region,
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      minConfidence: 50,
      ...providerConfig,
    };
  }

  isEnabled(): boolean {
    return !!(
      this.config.accessKeyId &&
      this.config.secretAccessKey &&
      this.config.region
    );
  }

  getName(): string {
    return 'aws-rekognition';
  }

  async moderateImage(imageBuffer: Buffer): Promise<VisionProviderResult> {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        categories: {},
        error: 'AWS Rekognition not configured',
      };
    }

    try {
      // Dynamic import to avoid hard dependency
      const { RekognitionClient, DetectModerationLabelsCommand } = await import(
        '@aws-sdk/client-rekognition'
      );

      const client = new RekognitionClient({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId!,
          secretAccessKey: this.config.secretAccessKey!,
        },
      });

      const command = new DetectModerationLabelsCommand({
        Image: { Bytes: imageBuffer },
        MinConfidence: this.config.minConfidence,
      });

      const response = await client.send(command);

      const categories: Record<string, { confidence: number; label: string }> =
        {};

      if (response.ModerationLabels) {
        for (const label of response.ModerationLabels) {
          if (label.Name && label.Confidence) {
            const mappedCategory = mapVisionCategory(
              label.Name,
              'aws-rekognition'
            );
            categories[mappedCategory] = {
              confidence: label.Confidence / 100,
              label: label.Name,
            };
          }
        }
      }

      return {
        enabled: true,
        categories,
        raw: response,
      };
    } catch (error) {
      return {
        enabled: false,
        categories: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async moderateVideo(_videoBuffer: Buffer): Promise<VisionProviderResult> {
    // For video, we'll need to extract frames first
    void _videoBuffer; // referenced to satisfy no-unused-vars
    // This is a simplified implementation - in practice, you'd want to use ffmpeg
    // to extract frames and then call moderateImage on each frame

    return {
      enabled: false,
      categories: {},
      error: 'Video moderation not yet implemented for AWS Rekognition',
    };
  }
}
