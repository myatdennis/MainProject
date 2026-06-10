# Tend 2.0

A mobile-first, iPad-primary life operating system for ADHD founders, parents, and builders.

## Setup

```bash
cd tend
npm install
cp .env.example .env
# fill in your Supabase credentials
npx expo start
```

## Project structure

```
tend/
├── App.tsx                    # Entry point
├── src/
│   ├── components/            # Shared components
│   │   └── ui/                # Base design system components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Supabase + MMKV setup
│   ├── navigation/            # Tab + sidebar navigators
│   ├── screens/               # Screen components by tab
│   ├── theme/                 # Colors, typography, spacing
│   └── types/                 # Shared TypeScript types
└── supabase/
    └── schema.sql             # Full database schema
```

## Sprint status

- [x] Sprint 1 — Foundation (navigation, design system, FAB, Supabase schema)
- [ ] Sprint 2 — Health Core (HealthKit, recovery/strain scores, Me tab)
- [ ] Sprint 3 — Today Tab (priorities, workout card, daily brief)
- [ ] Sprint 4 — Journal (handwriting, Skia canvas, mood, OCR)
- [ ] Sprint 5 — Brain Dump (dump → prioritize → plan)
- [ ] Sprint 6 — Training (workout logger, progressive overload, rehab)
- [ ] Sprint 7 — Nutrition + Progress (tracking, charts)
- [ ] Sprint 8 — Build Tab (goals, tasks, Founder HQ)
- [ ] Sprint 9 — Polish + Offline (sync queue, focus timer, notifications)
