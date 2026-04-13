import type { Dispatch, SetStateAction, RefObject } from 'react';
import VersionControl from '../../../components/VersionControl';
import AIContentAssistant from '../../../components/AIContentAssistant';
import type { Course } from '../../../types/courseTypes';
import type { CourseValidationIssue } from '../../../validation/courseValidation';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface CourseBuilderSettingsPanelProps {
  course: Course;
  setCourse: Dispatch<SetStateAction<Course>>;
}

interface CourseBuilderOverviewPanelProps {
  course: Course;
  setCourse: Dispatch<SetStateAction<Course>>;
  validationPanelRef: RefObject<HTMLDivElement | null>;
  validationPanelPulse: boolean;
  validationIsValid: boolean;
  blockingIssueCount: number;
  validationIssues: CourseValidationIssue[];
  firstNavigableIssue: CourseValidationIssue | null;
  onFocusValidationIssue: (issue: CourseValidationIssue) => void;
  integrityRepairSummary: Array<{ code: string; label: string; count: number }>;
  onDismissIntegrityRepairs: () => void;
}

export const CourseBuilderOverviewPanel = ({
  course,
  setCourse,
  validationPanelRef,
  validationPanelPulse,
  validationIsValid,
  blockingIssueCount,
  validationIssues,
  firstNavigableIssue,
  onFocusValidationIssue,
  integrityRepairSummary,
  onDismissIntegrityRepairs,
}: CourseBuilderOverviewPanelProps) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label htmlFor="admin-course-title" className="block text-sm font-medium text-gray-700 mb-2">Course Title *</label>
        <input
          id="admin-course-title"
          type="text"
          value={course.title}
          onChange={(e) => setCourse(prev => ({ ...prev, title: e.target.value }))}
          placeholder="e.g., Foundations of Inclusive Leadership"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor="admin-course-difficulty" className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
        <select
          id="admin-course-difficulty"
          value={course.difficulty}
          onChange={(e) => setCourse(prev => ({ ...prev, difficulty: e.target.value as Course['difficulty'] }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>
      </div>
    </div>

    <div>
      <label htmlFor="admin-course-description" className="block text-sm font-medium text-gray-700 mb-2">Description</label>
      <textarea
        id="admin-course-description"
        value={course.description}
        onChange={(e) => setCourse(prev => ({ ...prev, description: e.target.value }))}
        rows={4}
        placeholder="Describe what learners will gain from this course..."
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Learning Objectives</label>
      <div className="space-y-2">
        {(course.learningObjectives || []).map((objective, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              value={objective}
              onChange={(e) => {
                const updated = [...(course.learningObjectives || [])];
                updated[index] = e.target.value;
                setCourse(prev => ({ ...prev, learningObjectives: updated }));
              }}
              placeholder="Learning objective..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={() => {
                const updated = (course.learningObjectives || []).filter((_, i) => i !== index);
                setCourse(prev => ({ ...prev, learningObjectives: updated }));
              }}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setCourse(prev => ({
            ...prev,
            learningObjectives: [...(prev.learningObjectives || []), ''],
          }))}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          + Add Learning Objective
        </button>
      </div>
    </div>

    <div
      ref={validationPanelRef}
      className={`mt-4 rounded-2xl border px-4 py-3 shadow-sm transition-all ${
        validationIsValid ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'
      } ${validationPanelPulse ? 'ring-2 ring-amber-400' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {validationIsValid ? (
            <ShieldCheck className="h-5 w-5 text-green-600" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {validationIsValid ? 'All publish checks passed' : `${blockingIssueCount} publish blocker(s)`}
            </p>
            <p className="text-xs opacity-80">
              {validationIsValid
                ? 'Learners will see the latest content as soon as you publish.'
                : 'Resolve the issues below before publishing to learners.'}
            </p>
            {!validationIsValid && (
              <p className="text-xs mt-1">
                Each module needs at least one publish-ready lesson: a video with stored media metadata, a quiz with questions, or a text lesson with learner-facing content.
              </p>
            )}
          </div>
        </div>
        {!validationIsValid && firstNavigableIssue && (
          <button
            onClick={() => onFocusValidationIssue(firstNavigableIssue)}
            className="inline-flex items-center rounded-lg border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-white/40"
          >
            Focus first issue
          </button>
        )}
      </div>
      {validationIssues.length > 0 ? (
        <div className="mt-3 max-h-56 overflow-y-auto pr-1">
          <ul className="space-y-2">
            {validationIssues.map((issue, index) => {
              const canNavigate = Boolean(issue.lessonId || issue.moduleId);
              return (
                <li
                  key={`${issue.code}-${issue.lessonId ?? issue.moduleId ?? index}`}
                  className="flex items-start justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-sm shadow-sm ring-1 ring-black/5"
                >
                  <div>
                    <p className="font-semibold text-amber-900">{issue.message}</p>
                    <p className="text-xs text-amber-600">
                      {issue.severity.toUpperCase()} • {issue.code}
                    </p>
                  </div>
                  {canNavigate && (
                    <button
                      onClick={() => onFocusValidationIssue(issue)}
                      className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
                    >
                      Jump
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-green-800">
          Publish validation is using stricter checks, and your course passes them all.
        </p>
      )}
    </div>

    {integrityRepairSummary.length > 0 && (
      <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-orange-900">Auto-fixes applied to this draft</p>
            <p className="text-xs text-orange-700">
              We repaired missing lesson data during save/publish prep. Review these updates before publishing.
            </p>
          </div>
          <button
            onClick={onDismissIntegrityRepairs}
            className="inline-flex items-center rounded-lg border border-orange-300 px-3 py-1 text-xs font-semibold text-orange-900 hover:bg-orange-100"
          >
            Dismiss
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {integrityRepairSummary.map((entry) => (
            <li
              key={entry.code}
              className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm text-orange-900 ring-1 ring-orange-100"
            >
              <span>{entry.label}</span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                {entry.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Key Takeaways</label>
      <div className="space-y-2">
        {(course.keyTakeaways || []).map((takeaway, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              value={takeaway}
              onChange={(e) => {
                const updated = [...(course.keyTakeaways || [])];
                updated[index] = e.target.value;
                setCourse(prev => ({ ...prev, keyTakeaways: updated }));
              }}
              placeholder="Key takeaway..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={() => {
                const updated = (course.keyTakeaways || []).filter((_, i) => i !== index);
                setCourse(prev => ({ ...prev, keyTakeaways: updated }));
              }}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setCourse(prev => ({
            ...prev,
            keyTakeaways: [...(prev.keyTakeaways || []), ''],
          }))}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          + Add Key Takeaway
        </button>
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {(course.tags || []).map((tag, index) => (
          <span key={index} className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm flex items-center space-x-1">
            <span>{tag}</span>
            <button
              onClick={() => {
                const updated = (course.tags || []).filter((_, i) => i !== index);
                setCourse(prev => ({ ...prev, tags: updated }));
              }}
              className="text-orange-600 hover:text-orange-800"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          placeholder="Add a tag..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              const input = e.target as HTMLInputElement;
              const tag = input.value.trim();
              if (tag && !(course.tags || []).includes(tag)) {
                setCourse(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
                input.value = '';
              }
            }
          }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <span className="text-sm text-gray-500">Press Enter to add</span>
      </div>
    </div>
  </div>
);

export const CourseBuilderSettingsPanel = ({ course, setCourse }: CourseBuilderSettingsPanelProps) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
        <select
          value={course.type}
          onChange={(e) => setCourse(prev => ({ ...prev, type: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="Video">Video</option>
          <option value="Interactive">Interactive</option>
          <option value="Mixed">Mixed</option>
          <option value="Workshop">Workshop</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Time</label>
        <input
          type="text"
          value={course.estimatedTime}
          onChange={(e) => setCourse(prev => ({ ...prev, estimatedTime: e.target.value }))}
          placeholder="e.g., 45-60 minutes"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Prerequisites</label>
      <div className="space-y-2">
        {(course.prerequisites || []).map((prerequisite, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              value={prerequisite}
              onChange={(e) => {
                const updated = [...(course.prerequisites || [])];
                updated[index] = e.target.value;
                setCourse(prev => ({ ...prev, prerequisites: updated }));
              }}
              placeholder="Prerequisite..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={() => {
                const updated = (course.prerequisites || []).filter((_, i) => i !== index);
                setCourse(prev => ({ ...prev, prerequisites: updated }));
              }}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setCourse(prev => ({
            ...prev,
            prerequisites: [...(prev.prerequisites || []), ''],
          }))}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          + Add Prerequisite
        </button>
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Certification Settings</label>
      <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={course.certification?.available || false}
            onChange={(e) => setCourse(prev => ({
              ...prev,
              certification: {
                ...(prev.certification ?? { available: false, name: '', requirements: [], validFor: '1 year', renewalRequired: false }),
                available: e.target.checked,
              },
            }))}
            className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
          />
          <span className="text-sm text-gray-700">Offer certification for this course</span>
        </label>

        {course.certification?.available && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Name</label>
              <input
                type="text"
                value={course.certification.name}
                onChange={(e) => setCourse(prev => ({
                  ...prev,
                  certification: {
                    ...prev.certification!,
                    name: e.target.value,
                  },
                }))}
                placeholder="e.g., Inclusive Leadership Foundation Certificate"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Requirements</label>
              <div className="space-y-2">
                {course.certification.requirements.map((requirement, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={requirement}
                      onChange={(e) => {
                        const updated = [...course.certification!.requirements];
                        updated[index] = e.target.value;
                        setCourse(prev => ({
                          ...prev,
                          certification: {
                            ...prev.certification!,
                            requirements: updated,
                          },
                        }));
                      }}
                      placeholder="Certification requirement..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => {
                        const updated = course.certification!.requirements.filter((_, i) => i !== index);
                        setCourse(prev => ({
                          ...prev,
                          certification: {
                            ...prev.certification!,
                            requirements: updated,
                          },
                        }));
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setCourse(prev => ({
                    ...prev,
                    certification: {
                      ...prev.certification!,
                      requirements: [...prev.certification!.requirements, ''],
                    },
                  }))}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  + Add Requirement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

interface CourseBuilderHistoryPanelProps {
  course: Course;
  onRestore: (restored: Course) => void;
}

export const CourseBuilderHistoryPanel = ({ course, onRestore }: CourseBuilderHistoryPanelProps) => (
  <div className="space-y-6">
    <VersionControl course={course} onRestore={onRestore} />
  </div>
);

interface CourseBuilderOverviewAssistantProps {
  course: Course;
  onApplySuggestion: (suggestion: unknown) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}

export const CourseBuilderOverviewAssistant = ({
  course,
  onApplySuggestion,
  onDismissSuggestion,
}: CourseBuilderOverviewAssistantProps) => (
  <div className="mt-8">
    <AIContentAssistant
      course={course}
      onApplySuggestion={onApplySuggestion}
      onDismissSuggestion={onDismissSuggestion}
    />
  </div>
);
