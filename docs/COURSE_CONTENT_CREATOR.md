# Interactive Course Content Creator

## Features
- Create, edit, and page through interactive slides
- Add stock photos/graphics or upload images
- Generate AI voiceover for each slide
- Save and manage course content

## Integrations
- **AI Voiceover:** Use services like ElevenLabs, Google Cloud Text-to-Speech, or OpenAI TTS for generating mp3 files from slide text.
- **Stock Photos:** Integrate Unsplash, Pexels, or Pixabay APIs for stock media search.
- **Backend:** Save course content as JSON objects per user or course.

## Example API Usage
POST `/api/course/save`
```json
{
  "slides": [
    { "title": "Intro", "text": "Welcome!", "image": "url", "voiceover": "mp3url" }
  ]
}
```

## Extending
- Add slide transitions/animations in frontend
- Support custom voice/accents in voiceover API
