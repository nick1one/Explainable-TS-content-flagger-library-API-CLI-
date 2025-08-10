# blotato-content-moderator

A comprehensive, explainable content moderation system in TypeScript for social media posts. Combines rule-based detection with optional ML/LLM providers, computer vision, and contextual metadata analysis.

## Features

### Core Detection
- **Rule-based detectors**: profanity, hate/harassment, violence, sexual content, self-harm, spam/abuse, PII (email/phone/credit card), links/shorteners, all-caps, excessive repeats
- **ML/LLM text moderation**: Optional integration with OpenAI, Anthropic, or Perspective API for improved recall
- **Computer vision**: Image and video moderation using AWS Rekognition (optional)
- **Duplicate detection**: Perceptual hashing for images and keyframe hashing for videos

### Contextual Analysis
- **Account signals**: Account age, verification status, prior violations
- **Temporal patterns**: Burst posting detection, frequency analysis
- **Network effects**: Similar content clustering, cross-platform matching
- **Engagement quality**: Reply/like ratios, unique replier analysis

### Explainability & Configuration
- **Explainable**: Returns precise spans, reasons, and confidence scores for every flag
- **Configurable per platform**: Different thresholds for X/Instagram/TikTok/etc
- **Feature flags**: Enable/disable ML, vision, and database features
- **Weighted scoring**: Configurable weights for different detection sources

## Quick Start

### Installation

```bash
pnpm install
pnpm build
```

### Basic Usage

```bash
# CLI
node dist/cli.js --text "YOUR TEXT HERE"
node dist/cli.js --media-url "https://example.com/image.jpg" --media-type image

# Server
pnpm dev
# POST http://localhost:8787/moderate
```

## Environment Variables

### Feature Flags
```bash
ENABLE_LLM=true                    # Enable ML/LLM text moderation
ENABLE_REKOGNITION=true            # Enable AWS Rekognition vision
ENABLE_SUPABASE=true               # Enable database storage
DEBUG=true                         # Enable debug output
```

### Provider Configuration
```bash
# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=1000

# Anthropic
ANTHROPIC_API_KEY=your_key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Supabase
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
```

### Thresholds & Weights
```bash
THRESHOLD_BLOCK=70                # Score threshold for blocking
THRESHOLD_REVIEW=30               # Score threshold for review
THRESHOLD_DUPLICATE=0.15          # Hash similarity threshold

WEIGHT_RULE=1.0                   # Rule-based detection weight
WEIGHT_ML=0.8                     # ML detection weight
WEIGHT_VISION=0.9                 # Vision detection weight
WEIGHT_METADATA=0.3               # Context metadata weight
```

## API

### Library

```ts
import { moderateContent } from "blotato-content-moderator";

const result = await moderateContent("Some text", undefined, { 
  platform: "x",
  context: {
    account: {
      createdAt: "2024-01-01T00:00:00Z",
      priorViolations: 2
    },
    engagement: {
      likes: 1000,
      replies: 0
    }
  }
});
```

### HTTP API

```bash
POST /moderate
Content-Type: application/json

{
  "text": "Optional text content",
  "media": {
    "url": "https://example.com/image.jpg",
    "type": "image"
  },
  "platform": "x",
  "context": {
    "account": {
      "id": "user123",
      "createdAt": "2024-01-01T00:00:00Z",
      "isVerified": false,
      "priorViolations": 2
    },
    "postingHistory": {
      "last24hCount": 25,
      "lastHourCount": 5
    },
    "engagement": {
      "replies": 10,
      "likes": 100,
      "uniqueRepliers": 8
    }
  }
}
```

### CLI

```bash
# Text moderation
node dist/cli.js --text "Your text here" --platform x

# Media moderation
node dist/cli.js --media-url "https://example.com/image.jpg" --media-type image

# With debug output
node dist/cli.js --text "Your text" --debug
```

## Response Format

```jsonc
{
  "score": 72,                    // 0..100
  "label": "block",               // allow | review | block
  "platform": "x",
  "flags": [                      // individual findings
    {
      "source": "rule",           // rule | ml | vision | metadata
      "category": "spam",
      "weight": 30,
      "message": "Suspicious link shortener",
      "confidence": 0.95,         // ML/vision confidence (0-1)
      "indices": [42, 57],        // text spans
      "snippet": "https://bit.ly/xyz",
      "provider": "openai",       // provider name for ML/vision
      "frameIndex": 5,            // video frame index
      "mediaHash": "abc123"       // duplicate detection hash
    }
  ],
  "debug": {                      // when DEBUG=true
    "providers": {
      "openai": "enabled",
      "rekognition": "disabled"
    },
    "timings": {
      "total": 150,
      "ml": 100,
      "vision": 50
    }
  }
}
```

## Architecture

### Providers (Optional)
- **NLP**: OpenAI GPT-4, Anthropic Claude, Google Perspective API
- **Vision**: AWS Rekognition for image/video moderation
- **Storage**: Supabase for hash storage and result persistence

### Detection Pipeline
1. **Rule-based**: Fast first-pass using keyword and pattern matching
2. **ML/LLM**: Second-pass text analysis (if enabled)
3. **Vision**: Image/video analysis (if enabled)
4. **Context**: Metadata feature analysis (account, temporal, network, engagement)
5. **Scoring**: Weighted combination with configurable thresholds

### Media Processing
- **Images**: Perceptual hashing (pHash/dHash) for duplicate detection
- **Videos**: Keyframe extraction and per-frame analysis
- **Storage**: Hash-based similarity search for cross-platform detection

## Database Schema

If using Supabase, create these tables:

```sql
-- Media hash storage
CREATE TABLE media_hashes (
  hash TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  url TEXT,
  platform TEXT
);

-- Moderation results
CREATE TABLE moderation_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  score INTEGER NOT NULL,
  label TEXT NOT NULL,
  categories JSONB,
  account_id TEXT,
  platform TEXT NOT NULL,
  media_hash TEXT REFERENCES media_hashes(hash)
);
```

## Testing

```bash
# Run all tests
pnpm test

# Run with watch mode
pnpm test:watch

# Test specific features
pnpm test -- --grep "engagement"
```

## Development

```bash
# Development server
pnpm dev

# Build
pnpm build

# Lint
pnpm lint

# Format
pnpm format
```

## Notes & Trade-offs

- **Hybrid approach**: Combines fast rule-based detection with optional ML for improved recall
- **Explainable**: Every flag includes source, confidence, and reasoning
- **Configurable**: Feature flags and weights can be adjusted per deployment
- **Performance**: Rule-based first pass ensures fast response times
- **Scalability**: Optional providers and database integration for production use

## License

MIT
