# AI prompt templates for Analytics

## Weekly engagement summary
Prompt:
```
You are an analytics assistant for an LMS. Summarize the key engagement insights for the following data:
{DATA}

Output:
- 3 concise key takeaways (1-2 sentences each)
- 2 immediate concerns (bullet points)
- 2 recommended actions with rationale and estimated impact
```

## Course deep-dive
Prompt:
```
Given course-level aggregates and lesson-level dropoffs for course {COURSE_ID}, provide:
1) A short executive summary (3 sentences)
2) Top 3 lessons causing dropoff with suggested remediation for each
3) Suggested A/B tests to improve completion
```

## Survey sentiment framing
Prompt:
```
Given free-text survey responses and numeric ratings, provide a sentiment breakdown (positive/neutral/negative percentages), 3 representative quote snippets for each sentiment, and themes for product/UX improvements.
```

Store these prompts in `docs/ai_prompts/analytics_prompts.md` and use `server/routes/admin-analytics-summary.js` to forward to OpenAI with the dataset interpolated.
