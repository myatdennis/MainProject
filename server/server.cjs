const express = require('express');
const mockAIGenerateDEIACourse = require('../src/utils/aiMocks.cjs');

const app = express();
app.use(express.json());

// Helper: safe JSON parsing from OpenAI-like responses
function extractJsonFromText(text) {
  if (!text) return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/m);
  const jsonText = jsonMatch ? jsonMatch[0] : text;
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    return null;
  }
}

app.post('/api/ai/generate', async (req, res) => {
  const { title, audience, length, tone } = req.body || {};
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  // 1) If OPENAI_KEY is present, proxy the request to OpenAI
  if (OPENAI_KEY) {
    try {
      const system = `You are an assistant who generates structured course JSON following a strict schema. Respond ONLY with JSON parsable into a Course object with modules and lessons.`;
      const user = `Generate a DEIA training course for audience: ${audience || 'workplace'}, length: ${length || 'short'}, tone: ${tone || 'Practical'}. Include modules (4-6), lessons (video, interactive, quiz), short transcripts, suggested public-domain or rights-cleared video/image links, and metadata. Output valid JSON.`;

      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
          temperature: 0.2,
          max_tokens: 1500
        })
      });

      if (!r.ok) {
        const txt = await r.text();
        console.error('OpenAI error', r.status, txt);
      } else {
        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content;
        const parsed = extractJsonFromText(text);
        if (parsed) return res.json(parsed);
      }
    } catch (err) {
      console.error('OpenAI proxy failed', err);
    }
  }

  // 2) Try to return a mock course
  try {
    const course = mockAIGenerateDEIACourse({ title, audience, length, tone });
    return res.json(course);
  } catch (err) {
    console.error('Mock generation failed', err);
    return res.status(500).json({ error: 'Generation failed' });
  }
});

app.get('/api/ai/media', async (req, res) => {
  const query = (req.query?.query) || 'diversity';
  const PEXELS_KEY = process.env.PEXELS_API_KEY;

  if (PEXELS_KEY) {
    try {
      // Search photos
      const photosRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`, {
        headers: { Authorization: PEXELS_KEY }
      });
      const photosData = await photosRes.json();
      const images = (photosData.photos || []).map(p => ({ id: `pexels-img-${p.id}`, type: 'image', url: p.src.original, thumbnail: p.src.medium, provider: 'pexels' }));

      // Search videos
      const vidsRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=4`, {
        headers: { Authorization: PEXELS_KEY }
      });
      const vidsData = await vidsRes.json();
      const videos = (vidsData.videos || []).map(v => ({ id: `pexels-vid-${v.id}`, type: 'video', url: v.video_files?.[0]?.link || v.url, thumbnail: v.image, provider: 'pexels' }));

      return res.json([...images, ...videos]);
    } catch (err) {
      console.error('Pexels fetch failed', err);
    }
  }

  // Fallback sample suggestions
  return res.json([
    { id: 'img-sample-1', type: 'image', url: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', provider: 'mock' },
    { id: 'vid-sample-1', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: '', provider: 'mock' }
  ]);
});

const port = process.env.PORT || 4000;
app.get('/health', (_req, res) => res.json({ ok: true }));
app.listen(port, () => console.log(`AI server running on http://localhost:${port}`));

module.exports = app;
