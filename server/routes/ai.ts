import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import mockAIGenerateDEIACourse from '../../src/utils/aiMocks';

const router = express.Router();

// POST /api/ai/generate
router.post('/generate', async (req: Request, res: Response) => {
  const { title, audience, length, tone } = req.body || {};

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    // fallback to mock generator
    try {
      const course = mockAIGenerateDEIACourse({ title, audience, length, tone });
      return res.json(course);
    } catch (err) {
      console.error('Mock generation failed', err);
      return res.status(500).json({ error: 'Generation failed' });
    }
  }

  const system = `You are an assistant who generates structured course JSON following a strict schema. Respond ONLY with JSON parsable into a Course object with modules and lessons.`;
  const user = `Generate a DEIA training course for audience: ${audience || 'workplace'}, length: ${length || 'short'}, tone: ${tone || 'Practical'}. Include modules (4-6), lessons (video, interactive, quiz), short transcripts, suggested public-domain or rights-cleared video/image links, and metadata. Output valid JSON.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
        max_tokens: 1500
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('OpenAI error', r.status, txt);
      return res.status(502).json({ error: 'OpenAI error' });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return res.status(502).json({ error: 'No content from OpenAI' });

    // Try to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/m);
    const jsonText = jsonMatch ? jsonMatch[0] : text;
    const parsed = JSON.parse(jsonText);
    return res.json(parsed);
  } catch (err) {
    console.error('AI generate failed', err);
    return res.status(500).json({ error: 'Generation failed' });
  }
});

// GET /api/ai/media?query=...
router.get('/media', async (req: Request, res: Response) => {
  const query = (req.query.query as string) || 'diversity';
  const PEXELS_KEY = process.env.PEXELS_API_KEY;
  if (!PEXELS_KEY) {
    return res.json([
      { id: 'img-sample-1', type: 'image', url: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', provider: 'mock' },
      { id: 'vid-sample-1', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: '', provider: 'mock' }
    ]);
  }

  try {
    const imgRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`, {
      headers: { Authorization: PEXELS_KEY }
    });
    const imgData = await imgRes.json();
    const images = (imgData.photos || []).map((p: any) => ({ id: `pexels-img-${p.id}`, type: 'image', url: p.src.original, thumbnail: p.src.medium, provider: 'pexels' }));

    const vidRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=4`, {
      headers: { Authorization: PEXELS_KEY }
    });
    const vidData = await vidRes.json();
    const videos = (vidData.videos || []).map((v: any) => ({ id: `pexels-vid-${v.id}`, type: 'video', url: v.video_files?.[0]?.link || v.url, thumbnail: v.image, provider: 'pexels' }));

    return res.json([...images, ...videos]);
  } catch (err) {
    console.error('Media fetch failed', err);
    return res.status(500).json({ error: 'Media fetch failed' });
  }
});

export default router;
