import type { FunctionComponent } from 'react';
import { Plus, Navigation } from 'lucide-react';
import type { Module } from '../../types/courseTypes';

interface MobileModuleNavigatorProps {
  modules: Module[];
  activeModuleId?: string | null;
  onSelect: (moduleId: string) => void;
  onAddModule: () => void;
}

const MobileModuleNavigator: FunctionComponent<MobileModuleNavigatorProps> = ({
  modules,
  activeModuleId,
  onSelect,
  onAddModule,
}) => {
  return (
    <div className="md:hidden">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Navigation className="h-4 w-4 text-orange-500" />
        Touch-friendly module navigator
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
    </div>
  );
};

export default MobileModuleNavigator;
