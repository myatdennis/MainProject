import { CURRENT_CONTENT_SCHEMA_VERSION } from '../schema/contentSchema';
// A small migrator utility for lesson content. For now it ensures a schema_version
// key is present and allows future migrations to be applied centrally.
export function migrateLessonContent(raw) {
    if (!raw || typeof raw !== 'object')
        raw = {};
    const out = { ...raw };
    // If schema_version missing, treat as legacy v0 and set to 1
    if (out.schema_version == null) {
        // Apply initial migration steps from legacy shapes into v1 canonical shape
        out.schema_version = CURRENT_CONTENT_SCHEMA_VERSION;
        // Normalize common legacy keys to canonical names used in v1
        // 1) text content alias: `content` -> `textContent`
        if (out.content && !out.textContent) {
            out.textContent = out.content;
            // keep legacy field for backwards compatibility
        }
        // 2) video duration might be stored as a string in legacy imports
        if (out.videoDuration != null && typeof out.videoDuration === 'string') {
            const n = parseInt(out.videoDuration, 10);
            if (!Number.isNaN(n))
                out.videoDuration = n;
        }
        // 3) captions may use different keys (start/end/text). Normalize to startTime/endTime/text
        if (Array.isArray(out.captions)) {
            out.captions = out.captions.map((c) => {
                const start = c.startTime ?? c.start ?? c.from ?? c.s ?? 0;
                const end = c.endTime ?? c.end ?? c.to ?? c.e ?? 0;
                const text = c.text ?? c.content ?? c.caption ?? '';
                return { startTime: start, endTime: end, text };
            });
        }
        // 4) set a rough `type` hint when missing
        if (!out.type) {
            if (out.videoUrl || out.videoDuration)
                out.type = 'video';
            else if (out.textContent || out.content)
                out.type = 'text';
        }
        // 5) quiz legacy shapes: questions may be present under `questions` or `quiz.questions`.
        const maybeQuestions = out.questions || (out.quiz && out.quiz.questions) || null;
        if (maybeQuestions && Array.isArray(maybeQuestions)) {
            out.type = 'quiz';
            out.questions = maybeQuestions.map((q, qi) => {
                const text = q.text || q.question || q.prompt || '';
                const rawOptions = q.options || q.choices || q.answers || [];
                const options = Array.isArray(rawOptions)
                    ? rawOptions.map((opt, oi) => {
                        const optText = opt.text || opt.label || String(opt);
                        const id = opt.id || opt.label || `opt_${qi}_${oi}`;
                        const correct = !!(opt.correct || opt.isCorrect || opt.correct_answer || opt.is_answer);
                        return { id, text: optText, correct };
                    })
                    : [];
                return { id: q.id || `q_${qi}`, text, options, passingScore: q.passingScore ?? undefined };
            });
        }
        // 6) reflection shape: common keys `prompt` or `reflectionPrompt`
        if (!out.type && (out.prompt || out.reflectionPrompt)) {
            out.type = 'reflection';
            out.prompt = out.prompt || out.reflectionPrompt || '';
        }
        // 7) interactive activities: normalize `instructions` or `steps`
        if (!out.type && (out.instructions || out.steps || out.activity)) {
            out.type = 'interactive';
            out.instructions = out.instructions || (typeof out.activity === 'string' ? out.activity : undefined) || '';
            if (Array.isArray(out.steps)) {
                out.steps = out.steps.map((s, idx) => ({ id: s.id || `step_${idx}`, title: s.title || s.heading || `Step ${idx + 1}`, body: s.body || s.content || s.text || '' }));
            }
        }
    }
    // Future migrations can be applied here using switch(out.schema_version) {...}
    return out;
}
export default migrateLessonContent;
