import Fastify from 'fastify';
import { z } from 'zod';
import { moderateText } from './engine.js';

const app = Fastify({ logger: false });

const Body = z.object({
  text: z.string().min(1),
  platform: z.enum(['generic', 'x', 'instagram', 'tiktok']).optional(),
});

app.post('/moderate', async (req, reply) => {
  const parse = Body.safeParse(req.body);
  if (!parse.success) {
    reply.code(400).send({ error: parse.error.flatten() });
    return;
  }
  const { text, platform } = parse.data;
  const result = moderateText(text, { platform });
  reply.send(result);
});

const port = Number(process.env.PORT) || 8787;
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`Moderator API listening on http://localhost:${port}`);
});
