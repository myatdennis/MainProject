# Admin Survey Queue Visibility

## Overview
The admin experience now surfaces the state of the survey save queue everywhere a user edits or reviews survey data. This closes Phase‑2 Todo #4 by giving admins immediate feedback about offline persistence, pending changes, and manual flushing.

## Component: `SurveyQueueStatus`
- **Location:** `src/components/Survey/SurveyQueueStatus.tsx`
- **Variants:** `banner` (default) for global notices and `inline` for contextual toolbars.
- **Data Sources:** Listens to `surveyQueueEvents`, `getQueueLength()`, `getLastFlushTime()`, and `flushNow()` from `src/dal/surveys`.
- **States Covered:**
  - Offline mode (shows warning with queued count)
  - Pending queue (with optional "Flush now" CTA)
  - Synced/healthy (shows last flush timestamp)

### Integration Points
| Location | Variant | Flush Button | Purpose |
| --- | --- | --- | --- |
| `AdminLayout` banner (beneath header) | `banner` | Yes | Global awareness of queue/offline state across every admin route. |
| `AdminSurveys` toolbar | `inline` | No | Lightweight status while reviewing surveys without cluttering the actions bar. |
| `AdminSurveyBuilder` editor toolbar | `inline` | Yes | Immediate feedback during edit/save workflows with manual flush control. |

## UX Notes
- The banner inherits contextual colors (amber for offline, sky for pending, emerald for healthy) to align with the rest of the design system.
- Inline instances default to compact typography and hide the button unless `showFlushButton` is passed.
- The component auto-refreshes on queue mutations, manual flush events, and browser online/offline transitions.

## Operational Guidance
1. **Queued Items Detected:** Admins can trigger `Flush now` from either the global banner or Survey Builder inline status.
2. **Offline Mode:** When `navigator.onLine` is false, we disable flushing and show "Changes will sync once back online" messaging.
3. **Last Sync Reference:** Once a flush completes, the banner displays `Last sync <time>` so admins can confirm data freshness without digging into logs.

## Validation Checklist
- [x] Queue state renders in Admin Layout, Surveys list, and Survey Builder.
- [x] Manual flush button disabled while offline or mid-flush.
- [x] ESLint run on touched files (`npm run lint -- src/components/Survey/SurveyQueueStatus.tsx src/pages/Admin/AdminSurveys.tsx src/pages/Admin/AdminSurveyBuilder.tsx src/components/Admin/AdminLayout.tsx`).
- [x] Existing warnings limited to unrelated LMS progress service imports.

## Next Steps
- Consider surfacing the same component inside client-side survey preview flows for parity.
- Add Playwright coverage to assert banner messaging across offline/online mock states.
