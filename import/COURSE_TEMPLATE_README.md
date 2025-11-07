# Course Import Templates

Provide a JSON file matching one of the supported shapes and run the import script.

## Basic Template (One or More Courses)

File: `import/courses-template.json`

```json
{
  "courses": [
    {
      "title": "Leadership Foundations",
      "description": "Core principles and practices of effective, inclusive leadership.",
      "status": "draft",
      "difficulty": "Beginner",
      "tags": ["leadership", "management", "inclusion"],
      "modules": [
        {
          "title": "Introduction",
          "order": 1,
          "lessons": [
            {
              "type": "video",
              "title": "Welcome & Course Overview",
              "duration": "5 min",
              "content": {"videoUrl": "https://cdn.example.com/videos/welcome.mp4"},
              "order": 1
            },
            {
              "type": "quiz",
              "title": "Foundational Concepts Quiz",
              "content": {
                "questions": [
                  {
                    "text": "What is the first step in demonstrating empathy?",
                    "options": ["Offering solutions", "Active listening", "Sharing your experience", "Giving advice"],
                    "correctAnswerIndex": 1
                  }
                ],
                "passingScore": 80,
                "allowRetakes": true
              },
              "order": 2
            }
          ]
        }
      ]
    }
  ]
}
```

## Field Notes
- `id`, `slug`: optional; will be generated or derived if omitted.
- `status`: `draft` or `published`; publish later via API if left as draft.
- `estimatedDuration`: seconds (optional) – system will compute duration from lessons if omitted.
- Lesson `type` supported: `video`, `quiz`, `text`, `document`, `interactive`.
- Quiz lesson content: `{ questions: [{ text, options[], correctAnswerIndex, explanation? }], passingScore, allowRetakes?, showCorrectAnswers? }`.
- Video lesson content: `{ videoUrl, transcript? }`.
- Text lesson content: `{ textContent }`.
- Document lesson content: `{ fileUrl, fileName?, fileType? }`.

## Import Script (to be added)
We'll create `scripts/import_courses.js` that:
1. Reads a JSON file path (default: `import/courses-template.json`).
2. Iterates courses and POSTs to `/api/admin/courses` with full graph.
3. Reports success/fail counts.

## Running (after script exists)
```
node scripts/import_courses.js import/courses-template.json
```
Or via npm script:
```
npm run import:courses
```

## Validation Tips
- Ensure each module and lesson has a `title`.
- Provide at least one module and one lesson per module.
- For quizzes, include at least one question and options length >= 2.

## Next Step
Ask the assistant to "add the import script" when ready; it will be created automatically.
