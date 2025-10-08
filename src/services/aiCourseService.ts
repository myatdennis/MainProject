import { Course } from '../store/courseStore';
// Import the TS mock explicitly to avoid resolution ambiguity with .js/.cjs siblings
import { mockAIGenerateDEIACourse as fallbackMock } from '../utils/aiMocks.ts';

type MediaSuggestion = {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  provider?: string;
};

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const PEXELS_KEY = import.meta.env.VITE_PEXELS_API_KEY;

async function generateDEIACourse(options: { title?: string; audience?: string; length?: string; tone?: string }): Promise<Course> {
  // 1) Try local backend proxy first (keeps frontend free of API keys in dev)
  try {
    const proxyRes = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      return json as Course;
    }
  } catch (err) {
    // ignore and fall through to next strategy
    console.warn('Backend AI proxy not available or failed, falling back:', err);
  }

  // 2) If OPENAI_KEY is present in the frontend env (rare), call OpenAI directly
  if (OPENAI_KEY) {
    const system = `You are an assistant who generates structured course JSON following a strict schema. Respond ONLY with JSON parsable into a Course object with modules and lessons.`;
    const user = `Generate a DEIA training course for audience: ${options.audience || 'workplace'}, length: ${options.length || 'short'}, tone: ${options.tone || 'Practical'}. Include modules (4-6), lessons (video, interactive, quiz), short transcripts, suggested public-domain or rights-cleared video/image links, and metadata. Output valid JSON.`;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.2, max_tokens: 1500 })
      });
      if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('No content from OpenAI');
      const jsonMatch = text.match(/\{[\s\S]*\}/m);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      const parsed = JSON.parse(jsonText) as Course;
      return parsed;
    } catch (err) {
      console.warn('Direct OpenAI call failed, falling back to mock:', err);
    }
  }

  // 3) Fallback to local mock generator
  return fallbackMock(options as any);
}

async function fetchMediaSuggestions(query: string): Promise<MediaSuggestion[]> {
  if (!PEXELS_KEY) {
    // fallback sample suggestions
    return [
      { id: 'img-sample-1', type: 'image', url: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', provider: 'mock' },
      { id: 'vid-sample-1', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: '', provider: 'mock' }
    ];
  }

  try {
    const imgRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`, {
      headers: { Authorization: PEXELS_KEY }
    });
    if (!imgRes.ok) throw new Error('Pexels image search failed');
    const imgData = await imgRes.json();
    const images = (imgData.photos || []).map((p: any) => ({
      id: `pexels-img-${p.id}`,
      type: 'image' as const,
      url: p.src.original,
      thumbnail: p.src.medium,
      provider: 'pexels'
    }));

    // Pexels video search
    const vidRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=4`, {
      headers: { Authorization: PEXELS_KEY }
    });
    const vidData = await vidRes.json();
    const videos = (vidData.videos || []).map((v: any) => ({
      id: `pexels-vid-${v.id}`,
      type: 'video' as const,
      url: v.video_files?.[0]?.link || v.url,
      thumbnail: v.image,
      provider: 'pexels'
    }));

    return [...images, ...videos];
  } catch (err) {
    console.warn('Media fetch failed, returning mock', err);
    return [
      { id: 'img-sample-1', type: 'image', url: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg', provider: 'mock' },
      { id: 'vid-sample-1', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: '', provider: 'mock' }
    ];
  }
}

export { generateDEIACourse, fetchMediaSuggestions };
