import { describe, it, expect } from 'vitest';
import migrateLessonContent from '../contentMigrator';
import { CURRENT_CONTENT_SCHEMA_VERSION } from '../../schema/contentSchema';
describe('migrateLessonContent', () => {
    it('no-ops when schema_version already current', () => {
        const src = { schema_version: CURRENT_CONTENT_SCHEMA_VERSION, textContent: 'ok' };
        const out = migrateLessonContent(src);
        expect(out.schema_version).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(out.textContent).toBe('ok');
    });
    it('migrates legacy shape to v1 canonical shape', () => {
        const legacy = {
            // no schema_version -> legacy
            content: 'Legacy body',
            videoDuration: '123',
            captions: [{ start: 0, end: 5, content: 'hi' }],
            // intentionally no type
        };
        const out = migrateLessonContent(legacy);
        expect(out.schema_version).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(out.textContent).toBe('Legacy body');
        expect(typeof out.videoDuration).toBe('number');
        expect(out.videoDuration).toBe(123);
        expect(Array.isArray(out.captions)).toBe(true);
        expect(out.captions[0].startTime).toBe(0);
        expect(out.captions[0].endTime).toBe(5);
        expect(out.captions[0].text).toBe('hi');
        expect(['video', 'text'].includes(out.type)).toBe(true);
    });
    it('normalizes legacy quiz shapes into quiz schema', () => {
        const legacyQuiz = {
            questions: [
                { question: 'What is 2+2?', choices: [{ label: '3' }, { label: '4', isCorrect: true }] },
                { prompt: 'Select A', options: [{ text: 'A', correct: true }, { text: 'B' }] },
            ],
        };
        const out = migrateLessonContent(legacyQuiz);
        expect(out.schema_version).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(out.type).toBe('quiz');
        expect(Array.isArray(out.questions)).toBe(true);
        expect(out.questions[0].text).toContain('2+2');
        expect(Array.isArray(out.questions[0].options)).toBe(true);
        expect(out.questions[0].options.some((o) => o.correct)).toBe(true);
    });
    it('normalizes reflection shapes', () => {
        const legacyReflection = { reflectionPrompt: 'How did this make you feel?' };
        const out = migrateLessonContent(legacyReflection);
        expect(out.schema_version).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(out.type).toBe('reflection');
        expect(out.prompt).toBe('How did this make you feel?');
    });
    it('normalizes interactive activity shapes', () => {
        const legacyInteractive = { activity: 'Do the thing', steps: [{ heading: 'Step A', content: 'Do A' }] };
        const out = migrateLessonContent(legacyInteractive);
        expect(out.schema_version).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(out.type).toBe('interactive');
        expect(out.instructions).toBe('Do the thing');
        expect(Array.isArray(out.steps)).toBe(true);
        expect(out.steps[0].title).toBe('Step A');
    });
});
