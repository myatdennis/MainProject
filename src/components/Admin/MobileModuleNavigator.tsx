import type { FunctionComponent } from 'react';
import { Plus, Navigation, ArrowLeft, ArrowRight, Layers } from 'lucide-react';
import type { Module } from '../../types/courseTypes';

interface MobileModuleNavigatorProps {
  modules: Module[];
  activeModuleId?: string | null;
  onSelect: (moduleId: string) => void;
  onAddModule: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  totalLessons: number;
  onNext?: () => void;
  onPrevious?: () => void;
}

const MobileModuleNavigator: FunctionComponent<MobileModuleNavigatorProps> = ({
  modules,
  activeModuleId,
  onSelect,
  onAddModule,
  focusMode,
  onToggleFocusMode,
  totalLessons,
  onNext,
  onPrevious,
}) => {
  const activeIndex = modules.findIndex((module) => module.id === activeModuleId);
  const humanIndex = activeIndex >= 0 ? activeIndex + 1 : 0;
  const hasMultipleModules = modules.length > 1;

  return (
    <div className="md:hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-gray-700">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-orange-500" />
          Touch-friendly module navigator
        </div>
        {hasMultipleModules && (
          <button
            type="button"
            onClick={onToggleFocusMode}
            className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700"
          >
            <Layers className="h-3 w-3" />
            {focusMode ? 'Show all' : 'Focus mode'}
          </button>
        )}
      </div>
      <div className="mb-3 flex gap-2 text-xs text-gray-600">
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold">
          {modules.length} module{modules.length === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold">
          {totalLessons} lesson{totalLessons === 1 ? '' : 's'}
        </span>
      </div>
      <div className="no-scrollbar mb-4 flex gap-3 overflow-x-auto pb-2">
        {modules.map((module) => {
          const isActive = module.id === activeModuleId;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onSelect(module.id)}
              className={`min-w-[140px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                isActive
                  ? 'border-orange-400 bg-orange-50 text-orange-700'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
              }`}
            >
              <p className="truncate">{module.title || 'Untitled module'}</p>
              <p className="text-xs font-normal text-gray-500">{module.lessons.length} lessons</p>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAddModule}
          className="flex min-w-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-600"
        >
          <Plus className="mr-1 h-4 w-4" /> Module
        </button>
      </div>
      {hasMultipleModules && humanIndex > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <button
            type="button"
            onClick={onPrevious}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1"
          >
            <ArrowLeft className="h-3 w-3" /> Prev
          </button>
          <span>
            Module {humanIndex} / {modules.length}
          </span>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1"
          >
            Next <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileModuleNavigator;
