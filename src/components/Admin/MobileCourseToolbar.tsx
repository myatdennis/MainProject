import { Loader, Plus, Save, Eye } from 'lucide-react';
import type { FunctionComponent } from 'react';

interface MobileCourseToolbarProps {
  onAddModule: () => void;
  onPreview: () => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  disabled?: boolean;
}

const MobileCourseToolbar: FunctionComponent<MobileCourseToolbarProps> = ({
  onAddModule,
  onPreview,
  onSave,
  saveStatus,
  disabled = false,
}) => {
  const isSaving = saveStatus === 'saving';

  return (
    <div
      className="pointer-events-auto fixed inset-x-4 bottom-4 z-40 flex flex-col gap-2 rounded-3xl bg-white/95 p-4 shadow-2xl backdrop-blur-md ring-1 ring-black/5 md:hidden"
      aria-label="Mobile course builder actions"
    >
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-900">Quick actions</span>
        <span className="text-[11px] text-gray-400">Optimized for touch</span>
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
