# blotato-content-moderator

A tiny, explainable content flagger in TypeScript for social media posts. No hype — just clear rules, fast results, and a simple API/CLI.

- **Detectors**: profanity, hate/harassment, violence, sexual content, self-harm, spam/abuse, PII (email/phone/credit card), links/shorteners, all-caps, excessive repeats.
- **Explainable**: returns precise spans and reasons for every flag.
- **Configurable per platform**: different thresholds for X/Instagram/TikTok/etc.
- **Interfaces**: library, Fastify HTTP API, and CLI.
- **Zero external services** by default. (Optional hooks where you could add Perspective/OpenAI if desired.)
- Designed to be tuned quickly: adjust weights/thresholds in src/platforms.ts.
- Easy to add detectors or plug an ML service as a second pass.
- CLI exits non-zero for block, which is convenient in pipelines (n8n/Make/Zapier).


> ⚠️ For the interview constraint, this project is intentionally lightweight and written in under two hours. It demonstrates architecture, code quality and tests, not a full ML system.

## Quick start

```bash
pnpm i  # or npm i / yarn
pnpm build
node dist/cli.js --text "YOUR TEXT HERE"
# or
node dist/server.js
# POST http://localhost:8787/moderate  { "text": "..." }
```

## API

### Library

```ts
import { moderateText } from "blotato-content-moderator";

const result = moderateText("Some text", { platform: "generic" });
console.log(result);
```

### HTTP (Fastify)

```
POST /moderate
{ "text": "...", "platform": "x" | "instagram" | "tiktok" | "generic" }
```

### CLI

```bash
flag-post --text "I will send you $1000!! click https://bit.ly/xyz"
echo "some text" | flag-post
```

## Output shape

```jsonc
{
  "score": 72,            // 0..100
  "label": "block",       // allow | review | block
  "platform": "x",
  "flags": [              // individual findings
    {
      "category": "spam",
      "weight": 30,
      "message": "Suspicious link shortener",
      "indices": [42, 57],
      "snippet": "https://bit.ly/xyz"
    }
  ]
}
```

## Notes & trade-offs

- This is **rule-based** and **explainable** by design. It’s reliable for high-precision pre-screening, fast, and auditable.
- Multi-language support is basic (normalization + ascii folding). With more time, add per-language lists and unicode-aware tokenization.
- Placeholders are provided to integrate hosted models if needed.

## Tests

```bash
pnpm test
```

## License

MIT
