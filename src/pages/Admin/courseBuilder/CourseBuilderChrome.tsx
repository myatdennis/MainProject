import type { ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, Loader, RefreshCcw, Save, ShieldCheck, Undo2, Users, WifiOff, X, Trash2, Download, Copy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Course } from '../../../types/courseTypes';
import type { CourseValidationIssue } from '../../../validation/courseValidation';
import Button from '../../../components/ui/Button';

export type BannerTone = 'warning' | 'danger';
type ConfirmTone = 'info' | 'warning' | 'danger';

export interface BuilderBanner {
  tone: BannerTone;
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmLabel: string;
  tone: ConfirmTone;
}

const confirmToneIconClasses: Record<ConfirmTone, string> = {
  info: 'bg-blue-50 text-blue-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
};

const confirmToneButtonClasses: Record<ConfirmTone, string> = {
  info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
};

const bannerToneClasses: Record<BannerTone, { container: string; icon: string; cta: string }> = {
  warning: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'text-amber-600',
    cta: 'border border-amber-200 text-amber-900 hover:bg-amber-100',
  },
  danger: {
    container: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-600',
    cta: 'border border-red-200 text-red-900 hover:bg-red-100',
  },
};

export const CourseBuilderLoadingState = () => (
  <div className="p-6 max-w-4xl mx-auto">
    <div className="flex items-center space-x-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <Loader className="h-5 w-5 animate-spin text-orange-500" />
      <div>
        <p className="text-sm font-medium text-gray-900">Loading course builder…</p>
        <p className="text-xs text-gray-500">Fetching the latest course data.</p>
      </div>
    </div>
  </div>
);

interface CourseBuilderHeaderProps {
  course: Course;
  isEditing: boolean;
  staleFromOtherTab: boolean;
  setStaleFromOtherTab: (value: boolean) => void;
  onBack: () => void | Promise<void>;
  onReloadLatest: () => void;
  statusBanner: BuilderBanner | null;
  supabaseConnected: boolean;
  runtimeDemoModeEnabled: boolean;
  runtimeLastError: string | null;
  runtimeStatusLabel: string;
  runtimeLastCheckedLabel: string;
  draftSnapshotPrompt: { updatedAt: number } | null;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
  validationIsValid: boolean;
  blockingIssueCount: number;
  onDiscard: () => void;
  canDiscardChanges: boolean;
  onResetTemplate: () => void;
  onOpenPreview: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveButtonDisabled: boolean;
  saveButtonTitle: string;
  onOpenAssignments: () => void;
  assignmentDisabled: boolean;
  assignmentTitle: string;
  onPublish: () => void;
  publishDisabled: boolean;
  publishButtonTitle: string;
  publishDevHint: string | null;
  onOpenLearnerPreview: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  syncIndicator: ReactNode;
}

export const CourseBuilderHeader = ({
  course,
  isEditing,
  staleFromOtherTab,
  setStaleFromOtherTab,
  onBack,
  onReloadLatest,
  statusBanner,
  supabaseConnected,
  runtimeDemoModeEnabled,
  runtimeLastError,
  runtimeStatusLabel,
  runtimeLastCheckedLabel,
  draftSnapshotPrompt,
  onRestoreDraft,
  onDiscardDraft,
  validationIsValid,
  blockingIssueCount,
  onDiscard,
  canDiscardChanges,
  onResetTemplate,
  onOpenPreview,
  onSave,
  saveStatus,
  saveButtonDisabled,
  saveButtonTitle,
  onOpenAssignments,
  assignmentDisabled,
  assignmentTitle,
  onPublish,
  publishDisabled,
  publishButtonTitle,
  publishDevHint,
  onOpenLearnerPreview,
  onDuplicate,
  onExport,
  onDelete,
  syncIndicator,
}: CourseBuilderHeaderProps) => (
  <div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void onBack()}
      className="mb-4 inline-flex items-center text-orange-500 hover:text-orange-600"
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to Courses
    </Button>
    {staleFromOtherTab && (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-600 shrink-0" />
            <p className="font-semibold">
              This course was saved in another tab. Reload to get the latest version and avoid overwriting changes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setStaleFromOtherTab(false);
                onReloadLatest();
              }}
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
            >
              Reload Latest
            </button>
            <button
              onClick={() => setStaleFromOtherTab(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              title="Dismiss — your local changes will be saved on next autosave"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )}
    {statusBanner && (
      <div className={`mb-4 rounded-2xl p-4 text-sm ${bannerToneClasses[statusBanner.tone].container}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <statusBanner.icon className={`h-5 w-5 mt-0.5 ${bannerToneClasses[statusBanner.tone].icon}`} />
            <div>
              <p className="font-semibold">{statusBanner.title}</p>
              <p className="mt-1 leading-relaxed">{statusBanner.description}</p>
            </div>
          </div>
          {statusBanner.onAction && (
            <button
              onClick={statusBanner.onAction}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${bannerToneClasses[statusBanner.tone].cta}`}
            >
              {statusBanner.actionLabel || 'Retry'}
            </button>
          )}
        </div>
      </div>
    )}
    <div
      className={`mb-6 rounded-2xl border p-4 text-sm ${supabaseConnected ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          {supabaseConnected ? (
            <ShieldCheck className="h-5 w-5 mt-0.5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 mt-0.5 text-amber-600" />
          )}
          <div>
            <p className="font-semibold">
              {supabaseConnected ? 'Secure mode connected' : runtimeDemoModeEnabled ? 'Demo mode active' : 'Supabase connection degraded'}
            </p>
            <p className="mt-1 leading-relaxed">
              {supabaseConnected
                ? 'Edits sync to Supabase immediately. Publishing, assignments, and analytics reflect your changes in real time.'
                : runtimeDemoModeEnabled
                  ? 'You are editing in demo mode. Changes stay local until Supabase is re-enabled—export drafts before sharing externally.'
                  : 'Supabase is unreachable right now. Autosave continues locally, but publish/sync calls will retry once connectivity returns.'}
            </p>
            {!supabaseConnected && runtimeLastError && <p className="mt-2 text-xs opacity-80">Last error: {runtimeLastError}</p>}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${supabaseConnected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            Status: {runtimeStatusLabel}
          </span>
          <span className="text-xs opacity-80">Last health check {runtimeLastCheckedLabel}</span>
        </div>
      </div>
    </div>
    {draftSnapshotPrompt && (
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold">Unsynced local draft available</p>
            <p className="mt-1 leading-relaxed">
              We saved edits on {new Date(draftSnapshotPrompt.updatedAt).toLocaleString()} when Huddle couldn’t reach Supabase.
              Restore them to continue where you left off or discard the local copy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onRestoreDraft}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Restore draft
            </button>
            <button
              onClick={onDiscardDraft}
              className="inline-flex items-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
            >
              Discard local copy
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{isEditing ? 'Edit Course' : 'Create New Course'}</h1>
        <p className="text-gray-600">{isEditing ? `Editing: ${course.title}` : 'Build a comprehensive learning experience'}</p>
        {isEditing && (
          <div
            className={`mt-2 px-3 py-2 rounded-lg text-sm ${
              validationIsValid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {validationIsValid ? (
              <span>✅ Course is valid and ready to publish</span>
            ) : (
              <div>
                <span>⚠️ {blockingIssueCount} validation issue(s) detected</span>
                <p className="mt-1 text-xs">Resolve the blockers below before publishing.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full flex-col items-end gap-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={onDiscard}
            disabled={!canDiscardChanges}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              canDiscardChanges ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-gray-100 text-gray-400 cursor-not-allowed opacity-60'
            }`}
            title={canDiscardChanges ? 'Revert to the last saved draft' : 'No saved draft to revert to yet'}
          >
            <Undo2 className="h-4 w-4" />
            <span>Discard</span>
          </button>
          <button
            onClick={onResetTemplate}
            className="flex items-center gap-2 rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50"
            title="Replace everything with the starter template"
          >
            <RefreshCcw className="h-4 w-4" />
            <span>Reset Template</span>
          </button>
          <button
            onClick={() => void onOpenPreview()}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors duration-200 flex items-center space-x-2 font-medium"
            title="Preview course as learner"
          >
            <Eye className="h-4 w-4" />
            <span>Live Preview</span>
          </button>
          <button
            onClick={() => void onSave()}
            data-save-button
            disabled={saveButtonDisabled}
            title={saveButtonTitle}
            className={`px-6 py-3 rounded-lg transition-all duration-200 flex items-center space-x-2 font-medium ${
              saveStatus === 'saved'
                ? 'bg-green-500 text-white hover:bg-green-600'
                : saveStatus === 'error'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
            } ${saveButtonDisabled ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Saved just now</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <X className="h-4 w-4" />
                <span>Retry Save</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Draft</span>
                <span className="hidden md:inline text-xs opacity-75">⌘S</span>
              </>
            )}
          </button>
          <button
            onClick={onOpenAssignments}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2"
            disabled={assignmentDisabled}
            title={assignmentTitle}
          >
            <Users className="h-4 w-4" />
            <span>Assign Course</span>
          </button>
          <button
            onClick={onPublish}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
            disabled={publishDisabled}
            title={publishButtonTitle}
          >
            <CheckCircle className="h-4 w-4" />
            <span>{course.status === 'published' ? 'Update Published' : 'Publish Course'}</span>
            {publishDevHint && (
              <span className="text-xs font-semibold uppercase tracking-wide text-lime-100">
                {publishDevHint}
              </span>
            )}
          </button>
          <button
            onClick={onOpenLearnerPreview}
            className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
          >
            <Eye className="h-4 w-4" />
            <span>Preview</span>
          </button>
          <button
            onClick={onDuplicate}
            className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
          >
            <Copy className="h-4 w-4" />
            <span>Duplicate</span>
          </button>
          <button
            onClick={onExport}
            className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button
            onClick={onDelete}
            className="border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors duration-200 flex items-center space-x-2"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
        {syncIndicator}
      </div>
    </div>
  </div>
);

interface CourseBuilderConfirmDialogProps {
  config: ConfirmDialogConfig | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const CourseBuilderConfirmDialog = ({ config, onClose, onConfirm }: CourseBuilderConfirmDialogProps) => {
  if (!config) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${confirmToneIconClasses[config.tone]}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{config.description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmToneButtonClasses[config.tone]}`}
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface CourseBuilderValidationModalProps {
  isOpen: boolean;
  activeValidationIntent: 'draft' | 'publish';
  validationIssues: CourseValidationIssue[];
  onClose: () => void;
  onFix: (issue: CourseValidationIssue) => void;
}

export const CourseBuilderValidationModal = ({
  isOpen,
  activeValidationIntent,
  validationIssues,
  onClose,
  onFix,
}: CourseBuilderValidationModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-orange-500 font-semibold">
              {activeValidationIntent === 'publish' ? 'Publish blockers' : 'Draft validation'}
            </p>
            <h2 className="text-xl font-semibold text-gray-900 mt-1">Resolve the highlighted issues</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review each issue and jump directly to the module or lesson that needs attention.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close validation issues">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3">
          {validationIssues.map((issue, index) => (
            <div
              key={`${issue.code}-${issue.moduleId ?? 'course'}-${issue.lessonId ?? index}`}
              className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50 p-3"
            >
              <div>
                <p className="text-sm font-medium text-red-900">{issue.message}</p>
                {issue.path && <p className="text-xs text-red-600 mt-1">{issue.path}</p>}
              </div>
              <button
                onClick={() => onFix(issue)}
                className="ml-4 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-red-700"
              >
                Fix
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
