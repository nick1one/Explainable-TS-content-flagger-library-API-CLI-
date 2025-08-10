import Fastify from 'fastify';
import { ModerationRequestSchema } from './schema.js';
import { moderateContent } from './engine.js';
import { config } from './config.js';

const app = Fastify({ logger: false });

app.post('/moderate', async (req, reply) => {
  const parse = ModerationRequestSchema.safeParse(req.body);
  if (!parse.success) {
    reply.code(400).send({ error: parse.error.flatten() });
    return;
  }

  const { text, media, platform, context } = parse.data;

  try {
    const result = await moderateContent(text, media, {
      platform,
      context,
    });

    reply.send(result);
  } catch (error) {
    reply.code(500).send({
      error: 'Moderation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Health check endpoint
app.get('/health', async () => {
  return {
    status: 'ok',
    providers: {
      llm: config.enableLLM ? 'enabled' : 'disabled',
      vision: config.enableRekognition ? 'enabled' : 'disabled',
      supabase: config.enableSupabase ? 'enabled' : 'disabled',
    },
  };
});

const port = Number(process.env.PORT) || 8787;
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`Moderator API listening on http://localhost:${port}`);
  console.log(
    `Providers: LLM=${config.enableLLM ? 'ON' : 'OFF'}, Vision=${config.enableRekognition ? 'ON' : 'OFF'}, Supabase=${config.enableSupabase ? 'ON' : 'OFF'}`
  );
});
