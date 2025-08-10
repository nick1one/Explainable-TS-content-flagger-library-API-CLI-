import { z } from 'zod';

// Base flag interface
export const FlagSchema = z.object({
  source: z.enum(['rule', 'ml', 'vision', 'metadata']),
  category: z.string(),
  weight: z.number(),
  message: z.string(),
  confidence: z.number().optional(),
  indices: z.tuple([z.number(), z.number()]).optional(),
  snippet: z.string().optional(),
  frameIndex: z.number().optional(),
  mediaHash: z.string().optional(),
  provider: z.string().optional(),
  thumbPath: z.string().optional(),
});

export type Flag = z.infer<typeof FlagSchema>;

// Context schemas
export const AccountContextSchema = z.object({
  id: z.string().optional(),
  createdAt: z.string().optional(), // ISO date
  isVerified: z.boolean().optional(),
  priorViolations: z.number().optional(),
});

export const PostingHistorySchema = z.object({
  last24hCount: z.number().optional(),
  lastHourCount: z.number().optional(),
});

export const CrossPlatformSchema = z.object({
  similarPostHashes: z.array(z.string()).optional(),
});

export const NetworkSchema = z.object({
  similarTextClusterIds: z.array(z.string()).optional(),
});

export const EngagementSchema = z.object({
  replies: z.number().optional(),
  likes: z.number().optional(),
  uniqueRepliers: z.number().optional(),
});

export const ContextSchema = z.object({
  account: AccountContextSchema.optional(),
  postingHistory: PostingHistorySchema.optional(),
  crossPlatform: CrossPlatformSchema.optional(),
  network: NetworkSchema.optional(),
  engagement: EngagementSchema.optional(),
});

// Media schema
export const MediaSchema = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video']),
});

// Request schema
export const ModerationRequestSchema = z
  .object({
    text: z.string().optional(),
    media: MediaSchema.optional(),
    platform: z
      .enum(['generic', 'x', 'instagram', 'tiktok'])
      .default('generic'),
    context: ContextSchema.optional(),
  })
  .refine((data) => data.text || data.media, {
    message: 'Either text or media must be provided',
  });

// Response schema
export const ModerationResultSchema = z.object({
  score: z.number(),
  label: z.enum(['allow', 'review', 'block']),
  platform: z.string(),
  flags: z.array(FlagSchema),
  debug: z
    .object({
      providers: z.record(z.enum(['enabled', 'disabled'])),
      timings: z.record(z.number()),
    })
    .optional(),
});

// Provider result schemas
export const ProviderResultSchema = z.object({
  enabled: z.boolean(),
  categories: z.record(
    z.object({
      confidence: z.number(),
      label: z.string(),
    })
  ),
  raw: z.unknown().optional(),
  error: z.string().optional(),
});

export const VisionProviderResultSchema = ProviderResultSchema.extend({
  frames: z
    .array(
      z.object({
        index: z.number(),
        hash: z.string(),
        categories: z.record(
          z.object({
            confidence: z.number(),
            label: z.string(),
          })
        ),
      })
    )
    .optional(),
});

// Export types
export type ModerationRequest = z.infer<typeof ModerationRequestSchema>;
export type ModerationResult = z.infer<typeof ModerationResultSchema>;
export type ProviderResult = z.infer<typeof ProviderResultSchema>;
export type VisionProviderResult = z.infer<typeof VisionProviderResultSchema>;
export type Context = z.infer<typeof ContextSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type AccountContext = z.infer<typeof AccountContextSchema>;
export type PostingHistory = z.infer<typeof PostingHistorySchema>;
export type CrossPlatform = z.infer<typeof CrossPlatformSchema>;
export type Network = z.infer<typeof NetworkSchema>;
export type Engagement = z.infer<typeof EngagementSchema>;
