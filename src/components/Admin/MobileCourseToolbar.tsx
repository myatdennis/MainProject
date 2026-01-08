import { Loader, Plus, Save, Eye, Users, CheckCircle } from 'lucide-react';
import type { FunctionComponent } from 'react';

interface MobileCourseToolbarProps {
  onAddModule: () => void;
  onPreview: () => void;
  onSave: () => void;
  onAssign?: () => void;
  onPublish?: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  hasPendingChanges?: boolean;
  lastSaved?: Date | null;
  disabled?: boolean;
}

const MobileCourseToolbar: FunctionComponent<MobileCourseToolbarProps> = ({
  onAddModule,
  onPreview,
  onSave,
  onAssign,
  onPublish,
  saveStatus,
  hasPendingChanges,
  lastSaved,
  disabled = false,
}) => {
  const isSaving = saveStatus === 'saving';
  const savedLabel = lastSaved
    ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Draft synced';

  return (
    <div
      className="pointer-events-auto fixed inset-x-4 bottom-4 z-40 flex flex-col gap-2 rounded-3xl bg-white/95 p-4 shadow-2xl backdrop-blur-md ring-1 ring-black/5 md:hidden"
      aria-label="Mobile course builder actions"
    >
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">Quick actions</span>
          <span className="text-[11px] text-gray-400">Optimized for touch</span>
        </div>
        <span className={`${hasPendingChanges ? 'text-amber-600' : 'text-green-600'} flex items-center gap-1 font-semibold`}>
          <span className={`h-2 w-2 rounded-full ${hasPendingChanges ? 'bg-amber-500' : 'bg-green-500'}`} />
          {hasPendingChanges ? 'Unsynced changes' : savedLabel}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAddModule}
          disabled={disabled}
          className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="mr-2 inline h-4 w-4" /> Add module
        </button>
        <button
          type="button"
          onClick={onPreview}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 shadow-inner transition hover:bg-gray-50"
        >
          <Eye className="mr-2 inline h-4 w-4" /> Preview
        </button>
      </div>
      {(onAssign || onPublish) && (
        <div className="grid grid-cols-2 gap-2">
          {onAssign && (
            <button
              type="button"
              onClick={onAssign}
              className="flex items-center justify-center rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 shadow-inner transition hover:bg-gray-50"
            >
              <Users className="mr-2 h-4 w-4" /> Assign
            </button>
          )}
          {onPublish && (
            <button
              type="button"
              onClick={onPublish}
              className="flex items-center justify-center rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 shadow-inner transition hover:bg-green-100"
            >
              <CheckCircle className="mr-2 h-4 w-4" /> Publish
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || isSaving}
        className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-base font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? (
          <>
            <Loader className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" /> {saveStatus === 'saved' ? 'Saved' : 'Save draft'}
          </>
        )}
      </button>
    </div>
  );
};

export default MobileCourseToolbar;
