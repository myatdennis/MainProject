import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Sparkles, ChevronRight, Layers, Target } from 'lucide-react';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import AsyncStatePanel from '../../components/system/AsyncStatePanel';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { buildLearnerProgressSnapshot, loadStoredCourseProgress } from '../../utils/courseProgress';
import CoursePlayer from '../../components/CoursePlayer/CoursePlayer';

type SectionId = 'concept' | 'example' | 'your-turn' | 'apply-it';

const sectionCards: Array<{ id: SectionId; title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  {
    id: 'concept',
    title: 'Concept',
    description: 'Understand the core idea before you practice it. This lesson uses a structured walkthrough to make complex accounting concepts feel clear and manageable.',
    icon: Target,
  },
  {
    id: 'example',
    title: 'Example',
    description: 'See a real scenario in context and learn how the right answer is built step by step.',
    icon: Layers,
  },
  {
    id: 'your-turn',
    title: 'Your turn',
    description: 'Try the activity yourself with instant feedback and step-by-step validation.',
    icon: Sparkles,
  },
  {
    id: 'apply-it',
    title: 'Apply it',
    description: 'Capture what you learned and translate it into your own words to lock in understanding.',
    icon: CheckCircle2,
  },
];

const interactiveTableRows = [
  {
    id: 'revenue',
    account: 'Service Revenue',
    prompt: 'Record the revenue side of the transaction.',
    solution: 'Credit',
  },
  {
    id: 'cash',
    account: 'Cash',
    prompt: 'Record the cash inflow for the same sale.',
    solution: 'Debit',
  },
  {
    id: 'accountsReceivable',
    account: 'Accounts Receivable',
    prompt: 'If the sale had been made on credit instead, what would you select?',
    solution: 'Debit',
  },
  {
    id: 'retainedEarnings',
    account: 'Retained Earnings',
    prompt: 'Which side of the entry would increase retained earnings?',
    solution: 'Credit',
  },
];

type TableRow = (typeof interactiveTableRows)[number];

const LMSLessonView = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [tableAnswers, setTableAnswers] = useState<Record<string, string>>(
    Object.fromEntries(interactiveTableRows.map((row) => [row.id, '']))
  );
  const [checkedRows, setCheckedRows] = useState<Record<string, boolean>>({});
  const [showSolution, setShowSolution] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [autosaveMessage, setAutosaveMessage] = useState('Autosaved just now');

  const adminCatalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getAdminCatalogState);
  const learnerCatalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getLearnerCatalogState);
  const allCourses = useSyncExternalStore(courseStore.subscribe, courseStore.getAllCourses);

  useEffect(() => {
    if (adminCatalogState.phase !== 'idle' || learnerCatalogState.status !== 'idle') {
      return;
    }
    void courseStore.init();
  }, [adminCatalogState.phase, learnerCatalogState.status]);

  const resolvedCourse = useMemo(() => {
    if (!courseId) return null;
    return courseStore.resolveCourse(courseId);
  }, [courseId, allCourses]);

  const normalizedCourse = useMemo(() => {
    return resolvedCourse ? normalizeCourse(resolvedCourse) : null;
  }, [resolvedCourse]);

  const storedProgress = useMemo(() => {
    if (!normalizedCourse) {
      return null;
    }
    return loadStoredCourseProgress(normalizedCourse.slug);
  }, [normalizedCourse]);

  const learnerSnapshot = useMemo(() => {
    if (!normalizedCourse || !storedProgress) {
      return null;
    }
    return buildLearnerProgressSnapshot(
      normalizedCourse,
      new Set(storedProgress.completedLessonIds),
      storedProgress.lessonProgress || {},
      storedProgress.lessonPositions || {}
    );
  }, [normalizedCourse, storedProgress]);

  const progressPercent = learnerSnapshot ? Math.round((learnerSnapshot.overallProgress || 0) * 100) : 0;
  const lessonCount = normalizedCourse?.lessons ?? 0;
  const durationLabel = normalizedCourse?.duration || 'Self-paced';
  const completedLessonCount = storedProgress?.completedLessonIds.length ?? 0;
  const startedLessonCount = Object.values(storedProgress?.lessonProgress || {}).filter((value) => Number(value ?? 0) > 0).length;
  const currentLessonNumber = Math.max(1, Math.min(lessonCount, completedLessonCount + 1));
  const completedSectionCount = [
    true,
    true,
    Object.values(checkedRows).filter(Boolean).length === interactiveTableRows.length,
    reflectionText.trim().length >= 15,
  ].filter(Boolean).length;

  useEffect(() => {
    if (feedbackMessage) {
      const timer = window.setTimeout(() => setFeedbackMessage(null), 5000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [feedbackMessage]);

  useEffect(() => {
    setAutosaveMessage('Autosaved just now');
    const timer = window.setTimeout(() => setAutosaveMessage('All changes are stored automatically'), 2500);
    return () => window.clearTimeout(timer);
  }, [checkedRows, reflectionText]);

  const handleBackToCourse = () => {
    if (normalizedCourse?.slug) {
      navigate(`/lms/courses/${normalizedCourse.slug}`);
      return;
    }
    navigate('/lms/courses');
  };

  const handleAnswerChange = (rowId: string, value: string) => {
    setTableAnswers((prev) => ({ ...prev, [rowId]: value }));
  };

  const handleCheckAnswers = () => {
    const results: Record<string, boolean> = {};
    interactiveTableRows.forEach((row) => {
      const answer = (tableAnswers[row.id] || '').trim().toLowerCase();
      results[row.id] = answer === row.solution.toLowerCase();
    });
    setCheckedRows(results);
    const wrongCount = Object.values(results).filter((ok) => !ok).length;
    if (wrongCount === 0) {
      setFeedbackMessage('Great work — your journal entry is correct. +10 XP earned.');
    } else {
      setFeedbackMessage(`Nice attempt — ${wrongCount} item${wrongCount === 1 ? '' : 's'} need review.`);
    }
  };

  if (!resolvedCourse || !normalizedCourse) {
    const stillLoadingCatalog =
      adminCatalogState.phase === 'loading' ||
      (learnerCatalogState.status === 'idle' && allCourses.length === 0);
    if (stillLoadingCatalog) {
      return (
        <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-12 lg:px-12">
          <AsyncStatePanel state="loading" loadingLabel="Loading course..." className="w-full" />
        </div>
      );
    }
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-12 lg:px-12">
        <AsyncStatePanel
          state="error"
          title="Course not available"
          message="We couldn't find the course you were trying to open. It might have been unpublished or reassigned."
          retryLabel="Browse courses"
          onRetry={() => navigate('/lms/courses')}
        />
      </div>
    );
  }

  const sampleInsights = [
    { label: 'Lessons underway', value: `${startedLessonCount}/${lessonCount}` },
    { label: 'Milestone reached', value: `${progressPercent}% complete` },
    { label: 'Next checkpoint', value: `${currentLessonNumber}/${lessonCount}` },
  ];

  return (
    <div className="bg-softwhite pb-10">
      <div className="mx-auto max-w-7xl px-6 pt-8 lg:px-10">
        <div className="flex flex-col gap-6 rounded-[32px] border border-mist bg-white p-6 shadow-card-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate/70">
              <span className="rounded-full border border-slate/10 bg-slate-50 px-3 py-1">Lesson overview</span>
              <span className="rounded-full bg-sunrise/10 px-3 py-1 text-sunrise">Guided experience</span>
            </div>
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold text-charcoal">{normalizedCourse.title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate/75">
                A premium learning experience designed to keep you focused, reward momentum, and make every step feel purposeful.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-center lg:gap-3">
            <div className="rounded-3xl bg-slate-900/5 px-4 py-3 text-sm text-slate-700">{autosaveMessage}</div>
            <Button variant="secondary" size="sm" onClick={() => {
              setFeedbackMessage('Progress saved. You can resume anytime from your course dashboard.');
              handleBackToCourse();
            }}>
              Save & exit
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBackToCourse}>
              <ArrowLeft className="h-4 w-4" />
              Back to course
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="space-y-8">
            <Card tone="gradient" className="overflow-hidden p-6 lg:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-4">
                  <Badge tone="info" className="bg-sunrise/10 text-sunrise">Learning path</Badge>
                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate/70">{currentLessonNumber} of {lessonCount} lessons</p>
                    <h2 className="font-heading text-3xl font-semibold text-charcoal">Move from understanding to action in every step</h2>
                    <p className="max-w-2xl text-sm leading-6 text-slate/75">This lesson is organized around concept, example, practice, and reflection so you can learn faster and remember better.</p>
                  </div>
                </div>
                <div className="space-y-3 rounded-3xl bg-white p-5 shadow-card-sm border border-mist">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate/70">Course progress</div>
                  <div className="text-3xl font-semibold text-charcoal">{progressPercent}%</div>
                  <ProgressBar value={progressPercent} className="mt-3" />
                  <p className="text-xs text-slate/70">{completedLessonCount} completed • {durationLabel}</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              {sectionCards.map((section) => (
                <SectionCard
                  key={section.id}
                  title={section.title}
                  description={section.description}
                  icon={section.icon}
                  completed={
                    section.id === 'your-turn'
                      ? Object.values(checkedRows).filter(Boolean).length === interactiveTableRows.length
                      : section.id === 'apply-it'
                      ? reflectionText.trim().length >= 15
                      : true
                  }
                />
              ))}
            </div>

            <div id="concept" className="space-y-6">
              <SectionPanel title="Concept" subtitle="Why this matters in practice" accent="bg-skyblue/10 text-skyblue">
                <p className="text-sm leading-7 text-slate-700">
                  Accounting becomes easier when you can see a clear structure behind each transaction. In this lesson, you will focus on the underlying rule: every entry needs both a debit and a credit to keep the books balanced.
                </p>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex gap-3 rounded-2xl border border-mist bg-cloud/80 p-4">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-skyblue" />
                    <span>Build confidence with a simplified journal entry flow.</span>
                  </li>
                  <li className="flex gap-3 rounded-2xl border border-mist bg-cloud/80 p-4">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-skyblue" />
                    <span>Connect entries to financial outcomes instead of memorizing rules.</span>
                  </li>
                </ul>
              </SectionPanel>

              <div id="example" className="space-y-6">
                <SectionPanel title="Example" subtitle="See the lesson in action" accent="bg-forest/10 text-forest">
                  <p className="text-sm leading-7 text-slate-700">
                    Follow this example to see how a sale affects both cash and revenue. The goal is to move from observation to accurate application without getting lost in the details.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoCard label="Real-world context" value="Service revenue earned" />
                    <InfoCard label="What to track" value="Cash + Revenue" />
                  </div>
                </SectionPanel>
              </div>

              <div id="your-turn" className="space-y-6">
                <SectionPanel title="Your turn" subtitle="Practice with instant feedback" accent="bg-sunrise/10 text-sunrise">
                  <p className="text-sm leading-7 text-slate-700">
                    Use the table below to choose the correct debit or credit for each account. When you check your answers, you’ll see which entries are aligned with best practice.
                  </p>
                  <InteractiveTable
                    rows={interactiveTableRows}
                    answers={tableAnswers}
                    checkedRows={checkedRows}
                    showSolution={showSolution}
                    onAnswerChange={handleAnswerChange}
                    onCheckAnswers={handleCheckAnswers}
                    onToggleSolution={() => setShowSolution((current) => !current)}
                  />
                </SectionPanel>
              </div>

              <div id="apply-it" className="space-y-6">
                <SectionPanel title="Apply it" subtitle="Reflect on the lesson" accent="bg-indigo/10 text-indigo">
                  <p className="text-sm leading-7 text-slate-700">
                    Writing a short reflection helps move this concept from short-term recall to long-term understanding. Share your thought in the box below.
                  </p>
                  <textarea
                    value={reflectionText}
                    onChange={(event) => setReflectionText(event.target.value)}
                    placeholder="What stood out most from this lesson?"
                    className="min-h-[140px] w-full rounded-3xl border border-mist bg-white px-4 py-4 text-sm leading-6 text-slate-800 shadow-sm transition duration-200 focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue/20"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <span>{reflectionText.trim().length >= 15 ? 'Reflection saved.' : 'Write at least 15 characters to complete this section.'}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-700">+5 XP</span>
                  </div>
                </SectionPanel>
              </div>

              <Card tone="default" className="overflow-hidden border border-mist bg-white shadow-card-lg">
                <CoursePlayer namespace="lms" />
              </Card>
            </div>
          </main>

          <aside className="space-y-6 lg:sticky lg:top-8">
            <Card tone="muted" className="space-y-4 rounded-[28px] border border-mist bg-white p-6 shadow-card-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Your momentum</p>
                  <h3 className="mt-3 text-lg font-semibold text-charcoal">Progress insights</h3>
                </div>
                <Badge tone="positive" className="rounded-full bg-forest/10 text-forest">+10 XP</Badge>
              </div>
              <div className="space-y-3">
                {sampleInsights.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span>{item.label}</span>
                    <span className="font-semibold text-charcoal">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl bg-slate-950/5 p-4 text-sm text-slate-700">
                You’re making great progress. Keep going and complete the next activity to maintain your learning streak.
              </div>
            </Card>

            <Card tone="default" className="rounded-[28px] border border-mist bg-white p-6 shadow-card-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Jump to</p>
                  <h3 className="mt-1 text-lg font-semibold text-charcoal">Lesson sections</h3>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {sectionCards.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="flex items-center justify-between rounded-3xl border border-mist bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate/70 hover:bg-slate-100"
                  >
                    <span>{item.title}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </a>
                ))}
              </div>
            </Card>

            <Card tone="muted" className="rounded-[28px] border border-mist bg-white p-6 shadow-card-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Completion</p>
                  <h3 className="mt-1 text-lg font-semibold text-charcoal">Activity checklist</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-600">{completedSectionCount}/4 done</span>
              </div>
              <ProgressBar value={Math.round((completedSectionCount / 4) * 100)} className="mt-4" />
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Complete the interactive practice and reflection block to finish this lesson’s core activities.
              </p>
            </Card>
          </aside>
        </div>
      </div>

      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm animate-fade-in rounded-3xl border border-forest/20 bg-forest/10 px-5 py-4 shadow-lg shadow-forest/10 text-sm text-forest">
          {feedbackMessage}
        </div>
      )}
    </div>
  );
};

interface SectionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
}

const SectionCard = ({ title, description, icon: Icon, completed }: SectionCardProps) => {
  return (
    <div className="group overflow-hidden rounded-[28px] border border-mist bg-white p-6 shadow-card-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate/50">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-3xl bg-slate-950/5 text-slate-700 transition group-hover:bg-skyblue/10">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-charcoal">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            completed ? 'bg-forest/10 text-forest' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {completed ? 'Completed' : 'Pending'}
        </span>
      </div>
    </div>
  );
};

interface SectionPanelProps {
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}

const SectionPanel = ({ title, subtitle, accent, children }: SectionPanelProps) => {
  return (
    <div className="space-y-4 rounded-[32px] border border-mist bg-white px-6 py-6 shadow-card-sm">
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <h3 className="text-xl font-semibold text-charcoal">{subtitle}</h3>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
};

interface InfoCardProps {
  label: string;
  value: string;
}

const InfoCard = ({ label, value }: InfoCardProps) => (
  <div className="rounded-3xl border border-mist bg-slate-50 p-5 text-sm text-slate-700">
    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
    <p className="mt-2 text-base font-semibold text-charcoal">{value}</p>
  </div>
);

interface InteractiveTableProps {
  rows: TableRow[];
  answers: Record<string, string>;
  checkedRows: Record<string, boolean>;
  showSolution: boolean;
  onAnswerChange: (rowId: string, value: string) => void;
  onCheckAnswers: () => void;
  onToggleSolution: () => void;
}

const InteractiveTable = ({
  rows,
  answers,
  checkedRows,
  showSolution,
  onAnswerChange,
  onCheckAnswers,
  onToggleSolution,
}: InteractiveTableProps) => {
  return (
    <div className="space-y-5 rounded-[28px] border border-mist bg-slate-50 p-5 shadow-sm">
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[2fr_1fr_2fr] gap-0 border-b border-mist bg-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
            <span>Account</span>
            <span>Choice</span>
            <span>Context</span>
          </div>
          <div className="divide-y divide-mist">
            {rows.map((row) => {
              const isCorrect = checkedRows[row.id];
              const isFilled = answers[row.id]?.trim().length > 0;
              return (
                <div
                  key={row.id}
                  className={`grid min-h-[88px] grid-cols-[2fr_1fr_2fr] items-center gap-0 px-4 py-4 transition duration-200 ${
                    isCorrect === true
                      ? 'bg-forest/10'
                      : isCorrect === false
                      ? 'bg-deepred/5'
                      : 'bg-white'
                  } ${isFilled ? 'hover:bg-slate-50' : 'hover:bg-slate-100'}`}
                >
                  <div>
                    <p className="font-semibold text-slate-900">{row.account}</p>
                    <p className="mt-1 text-sm text-slate-600">{row.prompt}</p>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={answers[row.id] ?? ''}
                      onChange={(event) => onAnswerChange(row.id, event.target.value)}
                      placeholder="Debit or Credit"
                      className={`w-full rounded-3xl border px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 focus:border-skyblue focus:ring-2 focus:ring-skyblue/10 ${
                        isCorrect === true
                          ? 'border-forest/50 bg-forest/5'
                          : isCorrect === false
                          ? 'border-deepred/50 bg-deepred/5'
                          : 'border-mist bg-white'
                      }`}
                    />
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <p>{row.prompt}</p>
                    {showSolution && (
                      <div className="rounded-3xl bg-slate-100 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-600">
                        {row.solution}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-charcoal">Interactive exercise</p>
          <p className="text-sm text-slate-600">Complete each row, then check your answers for immediate feedback.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={onToggleSolution}>
            {showSolution ? 'Hide solution' : 'Show solution'}
          </Button>
          <Button variant="primary" size="sm" onClick={onCheckAnswers}>
            Check answers
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LMSLessonView;
