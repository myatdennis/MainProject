import express from 'express';
import mockAIGenerateDEIACourse from '../src/utils/aiMocks.js';
import fs from 'fs';

const app = express();
app.use(express.json());

app.post('/api/ai/generate', async (req, res) => {
  const { title, audience, length, tone } = req.body || {};
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    try {
      const course = mockAIGenerateDEIACourse({ title, audience, length, tone });
      return res.json(course);
    } catch (err) {
      console.error('Mock generation failed', err);
      return res.status(500).json({ error: 'Generation failed' });
    }
  }

  // If OPENAI_KEY is present, attempt a direct fetch to OpenAI from the server
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'Generate a Course JSON' }, { role: 'user', content: `Generate a DEIA course for ${audience}` }], temperature: 0.2, max_tokens: 1500 })
    });
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/m);
    const jsonText = jsonMatch ? jsonMatch[0] : text;
    const parsed = JSON.parse(jsonText);
    return res.json(parsed);
  } catch (err) {
    console.error('AI request failed, falling back to mock', err);
    const course = mockAIGenerateDEIACourse({ title, audience, length, tone });
    return res.json(course);
  }
});

app.get('/api/ai/media', async (req, res) => {
  const query = req.query.query || 'diversity';
  const PEXELS_KEY = process.env.PEXELS_API_KEY;
  if (!PEXELS_KEY) {
    return res.json([
      { id: 'img-sample-1', type: 'image', url: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', provider: 'mock' },
      { id: 'vid-sample-1', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: '', provider: 'mock' }
    ]);
  }

  try {
    const imgRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`, { headers: { Authorization: PEXELS_KEY } });
    const imgData = await imgRes.json();
    const images = (imgData.photos || []).map(p => ({ id: `pexels-img-${p.id}`, type: 'image', url: p.src.original, thumbnail: p.src.medium, provider: 'pexels' }));

    const vidRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=4`, { headers: { Authorization: PEXELS_KEY } });
    const vidData = await vidRes.json();
    const videos = (vidData.videos || []).map(v => ({ id: `pexels-vid-${v.id}`, type: 'video', url: v.video_files?.[0]?.link || v.url, thumbnail: v.image, provider: 'pexels' }));

    return res.json([...images, ...videos]);
  } catch (err) {
    console.error('Media fetch failed', err);
    return res.json([
      { id: 'img-sample-1', type: 'image', url: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', provider: 'mock' },
      { id: 'vid-sample-1', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: '', provider: 'mock' }
    ]);
  }
});

const port = process.env.PORT || 4000;
app.get('/health', (_req, res) => res.json({ ok: true }));
app.listen(port, () => console.log(`AI server running on http://localhost:${port}`));

export default app;
