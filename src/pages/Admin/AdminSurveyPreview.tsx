/**
 * AdminSurveyPreview
 *
 * Renders a read-only, learner-facing preview of a survey.
 * No editing, no autosave, no builder UI.
 * Accessed via /admin/surveys/:surveyId/preview
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Eye,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  MessageSquare,
  Users,
  Grid3X3,
  ArrowUpDown,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { getSurveyById } from '../../dal/surveys';
import type { Survey, SurveyQuestion, SurveySection } from '../../types/survey';

// ─── helpers ──────────────────────────────────────────────────────────────────

const isValidSurveyId = (id: string | undefined): id is string =>
  typeof id === 'string' && id.trim().length > 0;

const getQuestionIcon = (type: string) => {
  switch (type) {
    case 'multiple-choice':
      return <CheckCircle className="h-4 w-4 text-orange-500" />;
    case 'likert-scale':
      return <BarChart3 className="h-4 w-4 text-blue-500" />;
    case 'ranking':
      return <ArrowUpDown className="h-4 w-4 text-purple-500" />;
    case 'open-ended':
      return <MessageSquare className="h-4 w-4 text-green-500" />;
    case 'matrix':
      return <Grid3X3 className="h-4 w-4 text-indigo-500" />;
    case 'demographics':
      return <Users className="h-4 w-4 text-teal-500" />;
    default:
      return <CheckCircle className="h-4 w-4 text-gray-400" />;
  }
};

// ─── Question renderer (read-only) ────────────────────────────────────────────

const QuestionPreview = ({ question, index }: { question: SurveyQuestion; index: number }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      {/* Question header */}
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-200">
          {getQuestionIcon(question.type)}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {index + 1}. {question.title || 'Untitled question'}
            {question.required && (
              <span className="ml-1 text-red-500" aria-label="required">*</span>
            )}
          </p>
          {question.description && (
            <p className="mt-1 text-sm text-gray-500">{question.description}</p>
          )}
        </div>
        <Badge
          tone="info"
          className="flex-shrink-0 bg-gray-100 text-gray-500 text-[11px] capitalize"
        >
          {question.type.replace(/-/g, ' ')}
        </Badge>
      </div>

      {/* Response area — disabled, read-only */}
      <div className="pl-11">
        {(question.type === 'multiple-choice' || question.type === 'demographics') && (
          <div className="space-y-2">
            {(question.options ?? []).map((option, i) => (
              <label key={i} className="flex items-center gap-3 cursor-not-allowed opacity-70">
                <input
                  type={question.allowMultiple ? 'checkbox' : 'radio'}
                  name={`preview-${question.id}`}
                  disabled
                  className="h-4 w-4 border-gray-300 text-orange-500"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
            {question.allowOther && (
              <label className="flex items-center gap-3 cursor-not-allowed opacity-70">
                <input
                  type={question.allowMultiple ? 'checkbox' : 'radio'}
                  name={`preview-${question.id}`}
                  disabled
                  className="h-4 w-4 border-gray-300 text-orange-500"
                />
                <span className="text-sm text-gray-700 italic">Other (please specify)</span>
              </label>
            )}
            {(question.options ?? []).length === 0 && (
              <p className="text-sm italic text-gray-400">No options configured.</p>
            )}
          </div>
        )}

        {question.type === 'likert-scale' && question.scale && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>{question.scale.minLabel || 'Strongly Disagree'}</span>
              {question.scale.midLabel && <span>{question.scale.midLabel}</span>}
              <span>{question.scale.maxLabel || 'Strongly Agree'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {Array.from(
                { length: (question.scale.max ?? 5) - (question.scale.min ?? 1) + 1 },
                (_, i) => (question.scale?.min ?? 1) + i,
              ).map((val) => (
                <label key={val} className="flex flex-1 flex-col items-center gap-1 cursor-not-allowed opacity-70">
                  <input
                    type="radio"
                    name={`preview-${question.id}`}
                    disabled
                    className="h-4 w-4 border-gray-300 text-orange-500"
                  />
                  <span className="text-xs text-gray-600">{val}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {question.type === 'ranking' && (
          <div className="space-y-2">
            {(question.rankingItems ?? []).map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 opacity-70"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
            {(question.rankingItems ?? []).length === 0 && (
              <p className="text-sm italic text-gray-400">No ranking items configured.</p>
            )}
          </div>
        )}

        {question.type === 'open-ended' && (
          <textarea
            disabled
            placeholder="Your answer here…"
            rows={3}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 placeholder-gray-300 cursor-not-allowed resize-none"
          />
        )}

        {question.type === 'matrix' && question.matrixRows && question.matrixColumns && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse opacity-70">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 font-medium text-gray-600 w-1/3"></th>
                  {question.matrixColumns.map((col, i) => (
                    <th key={i} className="py-2 px-3 font-medium text-gray-600 text-center">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {question.matrixRows.map((row, ri) => (
                  <tr key={ri} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-700">{row}</td>
                    {question.matrixColumns!.map((_, ci) => (
                      <td key={ci} className="py-2 px-3 text-center">
                        <input
                          type="radio"
                          name={`preview-matrix-${question.id}-row-${ri}`}
                          disabled
                          className="h-4 w-4 border-gray-300 text-orange-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Section renderer ─────────────────────────────────────────────────────────

const SectionPreview = ({
  section,
  questionOffset,
}: {
  section: SurveySection;
  questionOffset: number;
}) => (
  <div className="space-y-4">
    <div className="border-l-4 border-orange-400 pl-4">
      <h2 className="text-lg font-semibold text-gray-900">{section.title || 'Untitled Section'}</h2>
      {section.description && <p className="text-sm text-gray-500 mt-1">{section.description}</p>}
    </div>
    {section.questions.length === 0 ? (
      <p className="text-sm italic text-gray-400 pl-5">No questions in this section.</p>
    ) : (
      section.questions.map((q, i) => (
        <QuestionPreview key={q.id} question={q} index={questionOffset + i} />
      ))
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const AdminSurveyPreview = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);

  const loadSurvey = useCallback(async (id: string) => {
    setIsLoading(true);
    setHasError(null);
    try {
      const data = await getSurveyById(id);
      if (!data) {
        setHasError('Survey not found. It may have been deleted or the ID is incorrect.');
        setSurvey(null);
      } else {
        setSurvey(data);
      }
    } catch (err) {
      console.error('[AdminSurveyPreview] Failed to load survey', err);
      setHasError(
        err instanceof Error ? err.message : 'Unable to load survey. Please try again.',
      );
      setSurvey(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isValidSurveyId(surveyId)) {
      setHasError('Invalid survey ID. Please return to the surveys list and try again.');
      setIsLoading(false);
      return;
    }
    void loadSurvey(surveyId);
  }, [surveyId, loadSurvey]);

  const totalQuestions = survey?.sections.reduce((sum, s) => sum + s.questions.length, 0) ?? 0;

  // ── Loading — render inline skeleton, NOT a full-page gate ──
  // Returning a full-screen spinner from a page component blocks [PAGE COMMIT]
  // and makes the navigation appear broken (URL updates, page doesn't change).
  // The skeleton renders inside the page chrome so the route commits immediately.
  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Breadcrumbs
            items={[
              { label: 'Admin', to: '/admin' },
              { label: 'Surveys', to: '/admin/surveys' },
              { label: 'Preview', to: '#' },
            ]}
          />
        </div>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-mist/40 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm font-medium text-gray-500">Loading survey preview…</p>
        </div>
      </div>
    );
  }

  // ── Error / not found ──
  if (hasError || !survey) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mb-4 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Survey Not Found</h1>
        <p className="mb-8 text-gray-500">{hasError ?? 'This survey could not be loaded.'}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/admin/surveys')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Surveys
          </Button>
          {isValidSurveyId(surveyId) && (
            <Button variant="secondary" onClick={() => void loadSurvey(surveyId)}>
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Preview ──
  let questionOffset = 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: 'Admin', to: '/admin' },
            { label: 'Surveys', to: '/admin/surveys' },
            { label: survey.title || 'Survey', to: `/admin/surveys/builder/${survey.id}` },
            { label: 'Preview' },
          ]}
        />
      </div>

      {/* Preview mode banner */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
        <div className="flex items-center gap-2 text-orange-700">
          <Eye className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-semibold">Preview Mode</span>
          <span className="text-sm text-orange-600">
            — This is how learners will see this survey. All inputs are disabled.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/admin/surveys/builder/${survey.id}`)}
          >
            <Edit2 className="mr-1.5 h-3.5 w-3.5" />
            Edit Survey
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
          >
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Survey card */}
      <Card padding="lg" className="mb-8 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{survey.title || 'Untitled Survey'}</h1>
            {survey.description && (
              <p className="mt-2 text-gray-600">{survey.description}</p>
            )}
          </div>
          <Badge
            tone={
              survey.status === 'published'
                ? 'positive'
                : survey.status === 'archived'
                ? 'attention'
                : 'neutral'
            }
            className="flex-shrink-0 capitalize"
          >
            {survey.status ?? 'draft'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-4 pt-2 text-sm text-gray-500">
          <span>{survey.sections.length} section{survey.sections.length !== 1 ? 's' : ''}</span>
          <span>{totalQuestions} question{totalQuestions !== 1 ? 's' : ''}</span>
          {survey.settings?.anonymityMode && (
            <span className="capitalize">{survey.settings.anonymityMode} responses</span>
          )}
        </div>
      </Card>

      {/* Sections + questions */}
      {survey.sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-semibold text-gray-700">No sections yet</p>
          <p className="mt-1 text-sm text-gray-500">
            This survey has no content.{' '}
            <button
              onClick={() => navigate(`/admin/surveys/builder/${survey.id}`)}
              className="font-medium text-orange-500 hover:text-orange-600 underline"
            >
              Open the builder
            </button>{' '}
            to add sections and questions.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {survey.sections.map((section) => {
            const node = (
              <SectionPreview
                key={section.id}
                section={section}
                questionOffset={questionOffset}
              />
            );
            questionOffset += section.questions.length;
            return node;
          })}
        </div>
      )}

      {/* Simulated submit */}
      {totalQuestions > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            disabled
            className="w-full max-w-xs opacity-60 cursor-not-allowed"
          >
            Submit Responses
          </Button>
          <p className="text-xs text-gray-400">
            Submit is disabled in preview mode.
          </p>
          {survey.completionSettings?.thankYouMessage && (
            <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 text-center max-w-xs">
              <strong>Completion message:</strong> "{survey.completionSettings.thankYouMessage}"
            </div>
          )}
        </div>
      )}

      {/* Reflection prompts */}
      {(survey.reflectionPrompts ?? []).length > 0 && (
        <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-blue-800">Reflection Prompts</h3>
          <ul className="list-disc list-inside space-y-1">
            {survey.reflectionPrompts!.map((prompt, i) => (
              <li key={i} className="text-sm text-blue-700">{prompt}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer nav */}
      <div className="mt-12 flex items-center justify-between border-t border-gray-200 pt-6">
        <Button variant="ghost" onClick={() => navigate('/admin/surveys')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          All Surveys
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/admin/surveys/builder/${survey.id}`)}
          >
            <Edit2 className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(`/admin/surveys/${survey.id}/preview`, '_blank')}
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Open in new tab
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSurveyPreview;
