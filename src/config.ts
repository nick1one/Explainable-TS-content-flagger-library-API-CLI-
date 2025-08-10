import { z } from 'zod';

const ConfigSchema = z.object({
  // Feature flags
  enableLLM: z.boolean().default(false),
  enableRekognition: z.boolean().default(false),
  enableSupabase: z.boolean().default(false),
  debug: z.boolean().default(false),

  // Provider configurations
  openai: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('gpt-4'),
    maxTokens: z.number().default(1000),
  }),
  anthropic: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('claude-3-sonnet-20240229'),
    maxTokens: z.number().default(1000),
  }),
  perspective: z.object({
    apiKey: z.string().optional(),
  }),

  // AWS configuration
  aws: z.object({
    region: z.string().default('us-east-1'),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
  }),

  // Supabase configuration
  supabase: z.object({
    url: z.string().optional(),
    anonKey: z.string().optional(),
  }),

  // Thresholds and weights
  thresholds: z.object({
    block: z.number().default(70),
    review: z.number().default(30),
    duplicate: z.number().default(0.15), // Hamming distance threshold
  }),

  // Feature weights
  weights: z.object({
    rule: z.number().default(1.0),
    ml: z.number().default(0.8),
    vision: z.number().default(0.9),
    metadata: z.number().default(0.3),
  }),

  // Temporal thresholds
  temporal: z.object({
    burstHour: z.number().default(10),
    burstDay: z.number().default(50),
  }),

  // Account thresholds
  account: z.object({
    newAccountDays: z.number().default(7),
    maxViolations: z.number().default(5),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

function getConfig(): Config {
  const config = ConfigSchema.parse({
    enableLLM: process.env.ENABLE_LLM === 'true',
    enableRekognition: process.env.ENABLE_REKOGNITION === 'true',
    enableSupabase: !!(
      process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ),
    debug: process.env.DEBUG === 'true',

    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '1000'),
    },
    perspective: {
      apiKey: process.env.PERSPECTIVE_API_KEY,
    },

    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },

    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    },

    thresholds: {
      block: parseInt(process.env.THRESHOLD_BLOCK || '70'),
      review: parseInt(process.env.THRESHOLD_REVIEW || '30'),
      duplicate: parseFloat(process.env.THRESHOLD_DUPLICATE || '0.15'),
    },

    weights: {
      rule: parseFloat(process.env.WEIGHT_RULE || '1.0'),
      ml: parseFloat(process.env.WEIGHT_ML || '0.8'),
      vision: parseFloat(process.env.WEIGHT_VISION || '0.9'),
      metadata: parseFloat(process.env.WEIGHT_METADATA || '0.3'),
    },

    temporal: {
      burstHour: parseInt(process.env.TEMPORAL_BURST_HOUR || '10'),
      burstDay: parseInt(process.env.TEMPORAL_BURST_DAY || '50'),
    },

    account: {
      newAccountDays: parseInt(process.env.ACCOUNT_NEW_DAYS || '7'),
      maxViolations: parseInt(process.env.ACCOUNT_MAX_VIOLATIONS || '5'),
    },
  });

  return config;
}

export const config = getConfig();
export { getConfig };
