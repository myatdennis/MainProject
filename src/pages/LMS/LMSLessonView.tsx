import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, Layers, Target } from 'lucide-react';

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
    description: 'Review the principle and how it applies to accounting entries.',
    icon: Target,
  },
  {
    id: 'example',
    title: 'Example',
    description: 'Walk through a real journal entry scenario step by step.',
    icon: Layers,
  },
  {
    id: 'your-turn',
    title: 'Practice',
    description: 'Complete a clean, guided entry table and validate your choices.',
    icon: CheckCircle2,
  },
  {
    id: 'apply-it',
    title: 'Apply it',
    description: 'Summarize the key idea in your own words to reinforce learning.',
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
  const currentLessonNumber = Math.max(1, Math.min(lessonCount, completedLessonCount + 1));

  useEffect(() => {
    if (feedbackMessage) {
      const timer = window.setTimeout(() => setFeedbackMessage(null), 5000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [feedbackMessage]);

  useEffect(() => {
    setAutosaveMessage('Saved automatically');
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
      setFeedbackMessage('All answers are correct. Great attention to detail.');
    } else {
      setFeedbackMessage(`Review ${wrongCount} response${wrongCount === 1 ? '' : 's'} before moving on.`);
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

  return (
    <div className="bg-softwhite pb-12 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pt-8 lg:px-10">
        <LessonHeader
          title={normalizedCourse.title}
          progress={progressPercent}
          lessonIndex={currentLessonNumber}
          lessonCount={lessonCount}
          durationLabel={durationLabel}
          onBack={handleBackToCourse}
          statusMessage={autosaveMessage}
        />

        <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
          <main className="space-y-8 lg:pr-4">
            <Card tone="default" className="rounded-[28px] border border-mist bg-white p-6 shadow-card-sm">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Lesson guide</p>
                  <h2 className="text-2xl font-semibold text-charcoal">Focused learning designed for professionals</h2>
                  <p className="max-w-2xl text-sm leading-6 text-slate-700">
                    This lesson is organized into clear sections with concept, example, practice, and reflection. Move through each part at your own pace while keeping the objective in view.
                  </p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Lesson progress</p>
                  <div className="mt-4 rounded-full bg-slate-200 p-1">
                    <div className="h-2 rounded-full bg-gradient-to-r from-skyblue to-forest transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{currentLessonNumber} of {lessonCount}</span>
                    <span>{progressPercent}% complete</span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {sectionCards.map((card) => (
                <ContentStepCard
                  key={card.id}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  completed={
                    card.id === 'your-turn'
                      ? Object.values(checkedRows).filter(Boolean).length === interactiveTableRows.length
                      : card.id === 'apply-it'
                      ? reflectionText.trim().length >= 15
                      : true
                  }
                />
              ))}
            </div>

            <SectionBlock id="concept" number={1} title="Concept" subtitle="What this means" accent="bg-skyblue/10 text-skyblue">
              <p className="text-sm leading-7 text-slate-700">
                Accounting is built on balanced entries. In this lesson, you will learn how a single transaction affects both sides of the ledger and why that balance is central to reliable financial reporting.
              </p>
              <ul className="mt-5 space-y-3 text-sm text-slate-700">
                <li className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <strong className="block text-slate-900">Key idea:</strong> Every journal entry requires a debit and a credit to maintain balance.
                </li>
                <li className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <strong className="block text-slate-900">Outcome:</strong> You will know how to classify transactions into the correct accounts and entry sides.
                </li>
              </ul>
            </SectionBlock>

            <SectionBlock id="example" number={2} title="Example" subtitle="How it works in practice" accent="bg-forest/10 text-forest">
              <p className="text-sm leading-7 text-slate-700">
                Consider a service sale that increases revenue and cash. This example shows how the same transaction is represented on both sides of the ledger.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard label="Scenario" value="Service sale for cash" />
                <InfoCard label="Focus" value="Revenue and cash flow" />
              </div>
              <CalloutBox title="Takeaway">
                When revenue is recognized, the credit side increases the revenue account while the debit side reflects the cash inflow.
              </CalloutBox>
            </SectionBlock>

            <SectionBlock id="your-turn" number={3} title="Practice" subtitle="Apply what you’ve learned" accent="bg-sunrise/10 text-sunrise">
              <p className="text-sm leading-7 text-slate-700">
                Complete the table below with the correct entry side for each account. Use the solution toggle only if you need clarification.
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
            </SectionBlock>

            <SectionBlock id="apply-it" number={4} title="Apply it" subtitle="Reflect on the learning" accent="bg-indigo/10 text-indigo">
              <p className="text-sm leading-7 text-slate-700">
                Summarize the key point from this lesson in a few sentences. This helps anchor the concept and supports practical recall.
              </p>
              <ReflectionInput value={reflectionText} onChange={(value) => setReflectionText(value)} />
            </SectionBlock>

            <Card tone="default" className="overflow-hidden border border-mist bg-white shadow-card-lg">
              <CoursePlayer namespace="lms" />
            </Card>
          </main>

          <aside className="space-y-6 lg:sticky lg:top-8">
            <Card tone="muted" className="rounded-[28px] border border-mist bg-white p-6 shadow-card-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Lesson navigation</p>
                  <h3 className="mt-2 text-lg font-semibold text-charcoal">Sections</h3>
                </div>
              </div>
              <SidebarNavigation items={sectionCards.map((item) => ({ id: item.id, title: item.title }))} />
            </Card>

            <Card tone="default" className="rounded-[28px] border border-mist bg-white p-6 shadow-card-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Takeaways</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Balanced entries keep reporting accurate.</p>
                  <p className="mt-2 text-slate-600">Use debit and credit classifications consistently for every transaction.</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Classify transactions by outcome.</p>
                  <p className="mt-2 text-slate-600">Revenue increases equity via credit, while cash increases assets via debit.</p>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-lg shadow-slate-200/10 text-sm text-slate-800">
          {feedbackMessage}
        </div>
      )}
    </div>
  );
};

const LessonHeader = ({
  title,
  progress,
  lessonIndex,
  lessonCount,
  durationLabel,
  onBack,
  statusMessage,
}: {
  title: string;
  progress: number;
  lessonIndex: number;
  lessonCount: number;
  durationLabel: string;
  onBack: () => void;
  statusMessage: string;
}) => (
  <div className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-card-sm sm:grid-cols-[minmax(0,1fr)_260px] sm:items-center">
    <div className="space-y-4">
      <Button variant="secondary" size="sm" onClick={onBack} className="w-fit">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to course
      </Button>
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Now learning</p>
        <h1 className="text-3xl font-semibold text-charcoal sm:text-4xl">{title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>{lessonIndex} of {lessonCount} lessons</span>
          <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-3 text-slate-700">{durationLabel}</span>
        </div>
      </div>
    </div>
    <div className="rounded-[28px] bg-slate-50 p-5 text-sm text-slate-700">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Progress</p>
          <p className="text-xl font-semibold text-charcoal">{progress}% complete</p>
        </div>
        <Badge tone="info" className="bg-white/90 text-slate-900">On track</Badge>
      </div>
      <ProgressBar value={progress} className="h-3 rounded-full" />
      <p className="mt-4 text-xs text-slate-500">{statusMessage}</p>
    </div>
  </div>
);

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-semibold text-charcoal">{value}</p>
  </div>
);

interface InteractiveTableProps {
  rows: Array<TableRow>;
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
}: InteractiveTableProps) => (
  <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
    {rows.map((row) => (
      <div key={row.id} className="grid gap-4 rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_220px]">
        <div>
          <p className="text-sm font-semibold text-charcoal">{row.account}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{row.prompt}</p>
        </div>
        <div className="space-y-2">
          <label className="sr-only" htmlFor={`answer-${row.id}`}>Answer for {row.account}</label>
          <input
            id={`answer-${row.id}`}
            value={answers[row.id] || ''}
            onChange={(event) => onAnswerChange(row.id, event.target.value)}
            placeholder="Debit or Credit"
            className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue/20"
          />
          {showSolution && (
            <p className="text-sm text-slate-600">Solution: <span className="font-semibold text-slate-900">{row.solution}</span></p>
          )}
          {checkedRows[row.id] !== undefined && (
            <p className={`text-sm font-semibold ${checkedRows[row.id] ? 'text-forest' : 'text-sunrise'}`}>
              {checkedRows[row.id] ? 'Correct' : 'Incorrect'}
            </p>
          )}
        </div>
      </div>
    ))}
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <Button onClick={onCheckAnswers}>Check answers</Button>
      <Button variant="secondary" onClick={onToggleSolution}>{showSolution ? 'Hide solution' : 'Show solution'}</Button>
    </div>
  </div>
);

interface SectionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
}

const ContentStepCard = ({ title, description, icon: Icon, completed }: SectionCardProps) => (
  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
    <div className="flex items-start gap-3">
      <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-charcoal">{title}</h3>
          {completed && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Complete</span>}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  </div>
);

interface SectionBlockProps {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}

const SectionBlock = ({ id, number, title, subtitle, accent, children }: SectionBlockProps) => (
  <section id={id} className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-card-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Section {number}</p>
        <h3 className="mt-2 text-2xl font-semibold text-charcoal">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className={`mt-1 h-10 min-w-[100px] rounded-full px-4 py-2 text-sm font-semibold ${accent}`}>
        {title}
      </div>
    </div>
    <div className="space-y-5">{children}</div>
  </section>
);

interface CalloutBoxProps {
  title: string;
  children: React.ReactNode;
}

const CalloutBox = ({ title, children }: CalloutBoxProps) => (
  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <div className="mt-3 text-sm leading-6 text-slate-700">{children}</div>
  </div>
);

interface ReflectionInputProps {
  value: string;
  onChange: (value: string) => void;
}

const ReflectionInput = ({ value, onChange }: ReflectionInputProps) => (
  <div className="space-y-3">
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Summarize the key insight from this lesson..."
      className="min-h-[170px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 shadow-sm transition focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue/20"
    />
    <div className="text-sm text-slate-600">A short paragraph is enough to make this reflection meaningful.</div>
  </div>
);

interface SidebarNavigationProps {
  items: Array<{ id: string; title: string }>;
}

const SidebarNavigation = ({ items }: SidebarNavigationProps) => (
  <nav className="space-y-2">
    {items.map((item) => (
      <a
        key={item.id}
        href={`#${item.id}`}
        className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
      >
        <span>{item.title}</span>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </a>
    ))}
  </nav>
);

export default LMSLessonView;
