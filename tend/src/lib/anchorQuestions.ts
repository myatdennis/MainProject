export type AnchorCategory = 'morning' | 'evening' | 'general' | 'recovery' | 'founder';

export interface AnchorQuestion {
  id: number;
  text: string;
  category: AnchorCategory;
}

const ANCHOR_QUESTIONS: AnchorQuestion[] = [
  { id: 1,  text: "What's the one thing that would make today feel like a win?", category: 'morning' },
  { id: 2,  text: "What's weighing on you that you haven't said out loud yet?", category: 'general' },
  { id: 3,  text: "Who needs something from you today, and what do you actually have to give?", category: 'founder' },
  { id: 4,  text: "What are you avoiding, and why?", category: 'general' },
  { id: 5,  text: "If today had a theme, what would it be?", category: 'morning' },
  { id: 6,  text: "What did your body tell you today that you almost ignored?", category: 'recovery' },
  { id: 7,  text: "Where did your attention keep going when it wasn't supposed to?", category: 'general' },
  { id: 8,  text: "What decision have you been circling around?", category: 'founder' },
  { id: 9,  text: "What would you do today if you weren't trying to prove anything?", category: 'founder' },
  { id: 10, text: "What's the smallest version of progress that still counts?", category: 'general' },
  { id: 11, text: "What did you notice about your energy today?", category: 'recovery' },
  { id: 12, text: "What are you grateful for that you haven't acknowledged yet?", category: 'evening' },
  { id: 13, text: "What conversation are you putting off?", category: 'founder' },
  { id: 14, text: "What does rest actually look like for you right now?", category: 'recovery' },
  { id: 15, text: "What's happening in your work that you haven't named?", category: 'founder' },
  { id: 16, text: "What moment today felt most like you?", category: 'evening' },
  { id: 17, text: "What are you building, and why does it matter to you personally?", category: 'founder' },
  { id: 18, text: "Where did you show up well today, even a little?", category: 'evening' },
  { id: 19, text: "What do you need to let go of before tomorrow?", category: 'evening' },
  { id: 20, text: "What's one thing you learned today — about yourself, not a skill?", category: 'general' },
  { id: 21, text: "If your nervous system could talk, what would it say right now?", category: 'recovery' },
  { id: 22, text: "What would you tell a version of yourself from six months ago?", category: 'general' },
  { id: 23, text: "What boundary did you hold or fail to hold today?", category: 'founder' },
  { id: 24, text: "What's been true for a while that you keep not writing down?", category: 'general' },
  { id: 25, text: "What's the signal under the noise today?", category: 'founder' },
  { id: 26, text: "What did your training teach you that isn't about fitness?", category: 'recovery' },
  { id: 27, text: "Where are you being hard on yourself for no good reason?", category: 'general' },
  { id: 28, text: "What's the bravest thing you could do in the next 24 hours?", category: 'morning' },
  { id: 29, text: "What does \"enough\" look like for you today?", category: 'general' },
  { id: 30, text: "What part of your life is asking for more attention?", category: 'general' },
];

export function getAnchorQuestion(
  date: Date,
  recoveryScore: number,
  isEvening?: boolean,
): AnchorQuestion {
  const dayOfYear = getDayOfYear(date);
  const hour = date.getHours();
  const isEveningTime = isEvening ?? hour >= 17;

  // Recovery-aware: low recovery → recovery questions more often
  const candidates = ANCHOR_QUESTIONS.filter(q => {
    if (isEveningTime && q.category === 'morning') return false;
    if (!isEveningTime && q.category === 'evening') return false;
    if (recoveryScore < 34 && q.category === 'recovery') return true; // prioritize
    return true;
  });

  // Weight recovery questions when tired
  let pool = candidates;
  if (recoveryScore < 34) {
    const recoveryQs = candidates.filter(q => q.category === 'recovery');
    // 40% chance recovery question when low
    if (dayOfYear % 5 < 2 && recoveryQs.length > 0) {
      pool = recoveryQs;
    }
  }

  const index = dayOfYear % pool.length;
  return pool[index];
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}
