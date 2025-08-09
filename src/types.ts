export type Category =
  | 'profanity'
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'selfharm'
  | 'pii'
  | 'spam'
  | 'links';

export interface Flag {
  category: Category;
  weight: number; // contribution to score
  message: string;
  indices: [number, number]; // [start, end)
  snippet: string;
}

export interface ModerationOptions {
  platform?: 'generic' | 'x' | 'instagram' | 'tiktok';
}

export interface ModerationResult {
  score: number; // 0..100
  label: 'allow' | 'review' | 'block';
  platform: NonNullable<ModerationOptions['platform']>;
  flags: Flag[];
}
