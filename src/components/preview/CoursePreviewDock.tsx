import { useMemo, useState, useEffect } from 'react';
import { Monitor, Tablet, Smartphone, ExternalLink, Maximize2, Sparkles, Clock, Users, BookOpen, Zap } from 'lucide-react';
import type { Course, Lesson, Module } from '../../types/courseTypes';
import { calculateCourseDuration, countTotalLessons } from '../../store/courseStore';
import SurveyQueueStatus from '../Survey/SurveyQueueStatus';

interface CoursePreviewDockProps {
  course: Course;
  activeLessonId?: string | null;
  onLaunchFullPreview: () => void;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type PersonaView = 'learner' | 'instructor';

const devicePresets: Record<DeviceMode, { width: number; label: string; frameClass: string; radius: string }> = {
  desktop: {
    width: 1100,
    label: 'Desktop',
    frameClass: 'border border-gray-200 shadow-lg',
    radius: 'rounded-2xl'
  },
  tablet: {
    width: 820,
    label: 'Tablet',
    frameClass: 'border-4 border-gray-700 shadow-xl bg-black/90 p-2',
    radius: 'rounded-[28px]'
  },
  mobile: {
    width: 414,
    label: 'Mobile',
    frameClass: 'border-[10px] border-gray-900 shadow-2xl bg-black p-2',
    radius: 'rounded-[36px]'
  }
};

const emptyModules: Module[] = [];

const relativeTime = (timestamp: number) => {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const CoursePreviewDock = ({ course, activeLessonId, onLaunchFullPreview }: CoursePreviewDockProps) => {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [personaView, setPersonaView] = useState<PersonaView>('learner');
  const [lastUpdatedTs, setLastUpdatedTs] = useState(() => Date.now());

  useEffect(() => {
    setLastUpdatedTs(Date.now());
  }, [course, activeLessonId]);

  const preset = devicePresets[deviceMode];

  const stats = useMemo(() => ({
    duration: calculateCourseDuration(course.modules || []),
    lessons: countTotalLessons(course.modules || []),
    difficulty: course.difficulty ?? 'Beginner'
  }), [course]);

  const activeContext = useMemo(() => {
    if (!activeLessonId) return null;
    for (const module of course.modules || emptyModules) {
      const lesson = (module.lessons || []).find((entry: Lesson) => entry.id === activeLessonId);
      if (lesson) {
        return { module, lesson };
      }
    }
    return null;
  }, [course.modules, activeLessonId]);

  const secondaryModules = useMemo(() => (course.modules || emptyModules).slice(0, 4), [course.modules]);

  const relativeUpdated = useMemo(() => relativeTime(lastUpdatedTs), [lastUpdatedTs]);

  const learnerBanner = personaView === 'learner'
    ? 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500'
    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500';

  const personaLabel = personaView === 'learner' ? 'Learner perspective' : 'Instructor QA mode';

  return (
    <aside className="space-y-4 xl:sticky xl:top-8">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Live Preview</p>
            <p className="text-base font-semibold text-gray-900">Split-screen simulator</p>
            <p className="text-xs text-gray-500">Updates {relativeUpdated}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPersonaView('learner')}
              className={`px-3 py-1 text-xs font-semibold rounded-full border ${personaView === 'learner' ? 'border-sky-400 text-sky-700 bg-sky-50' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              Learner
            </button>
            <button
              type="button"
              onClick={() => setPersonaView('instructor')}
              className={`px-3 py-1 text-xs font-semibold rounded-full border ${personaView === 'instructor' ? 'border-amber-400 text-amber-700 bg-amber-50' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              Instructor
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
          <SurveyQueueStatus
            variant="inline"
            dataTestId="survey-preview-queue-status"
            showFlushButton
          />
        </div>

        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-full p-1 text-gray-600">
              <button
                className={`p-2 rounded-full ${deviceMode === 'desktop' ? 'bg-white text-blue-600 shadow border border-blue-100' : 'hover:text-gray-900'}`}
                onClick={() => setDeviceMode('desktop')}
                title="Desktop preview"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                className={`p-2 rounded-full ${deviceMode === 'tablet' ? 'bg-white text-blue-600 shadow border border-blue-100' : 'hover:text-gray-900'}`}
                onClick={() => setDeviceMode('tablet')}
                title="Tablet preview"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                className={`p-2 rounded-full ${deviceMode === 'mobile' ? 'bg-white text-blue-600 shadow border border-blue-100' : 'hover:text-gray-900'}`}
                onClick={() => setDeviceMode('mobile')}
                title="Mobile preview"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
            <span className="text-xs text-gray-500">{devicePresets[deviceMode].label} viewport</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLaunchFullPreview}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-300"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Detach
            </button>
            <a
              href={`/client/courses/${course.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Client view
            </a>
          </div>
        </div>

        <div className="px-4 pb-5">
          <div className="relative w-full overflow-x-auto">
            <div
              className={`mx-auto ${preset.frameClass} ${preset.radius} bg-white overflow-hidden transition-all duration-300`}
              style={{ width: preset.width }}
            >
              <div className={`${learnerBanner} px-6 py-5 text-white`}
                data-testid="preview-banner"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                  <span className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-4 w-4" />
                    {personaLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
                    <Zap className="h-3 w-3" />
                    Live
                  </span>
                </div>
                <h3 className="text-2xl font-bold mt-3 leading-tight">{course.title || 'Untitled course'}</h3>
                <p className="text-sm text-white/80 mt-1 line-clamp-2">
                  {course.description || 'Learners will see your course description here.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/90">
                  <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{stats.duration}</span>
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4" />{stats.lessons} lessons</span>
                  <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{stats.difficulty}</span>
                </div>
              </div>

              <div className="bg-white px-6 py-5 space-y-5">
                {activeContext ? (
                  <div className="border border-blue-100 bg-blue-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Focused lesson</p>
                    <h4 className="text-lg font-semibold text-gray-900">{activeContext.lesson.title}</h4>
                    <p className="text-sm text-gray-600">Module: {activeContext.module.title}</p>
                  </div>
                ) : (
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Focus a lesson</p>
                    <p className="text-sm text-gray-600">Open any lesson editor to see a live learner preview here.</p>
                  </div>
                )}

                <div className="space-y-3" aria-label="module-preview-list">
                  {secondaryModules.map((module, index) => (
                    <div key={module.id || index} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase text-gray-500">Module {index + 1}</p>
                          <p className="text-sm font-semibold text-gray-900">{module.title || 'Untitled module'}</p>
                        </div>
                        <span className="text-xs text-gray-500">{(module.lessons || []).length} lessons</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {(module.lessons || []).slice(0, 3).map((lesson) => (
                          <div
                            key={lesson.id}
                            className={`text-xs px-2 py-1 rounded-md border ${lesson.id === activeLessonId ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-600'}`}
                          >
                            {lesson.title || 'Lesson title'}
                          </div>
                        ))}
                        {(module.lessons || []).length > 3 && (
                          <p className="text-[11px] text-gray-400">+{(module.lessons || []).length - 3} more lessons</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {secondaryModules.length === 0 && (
                    <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-4">
                      Add a module to see a real-time outline preview.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Preview tips</p>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="text-gray-400">•</span>
            Use the device toggles to validate responsive layouts instantly.
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">•</span>
            Switch perspectives to validate learner vs instructor messaging.
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">•</span>
            Detach the preview for a full learner journey walkthrough whenever needed.
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default CoursePreviewDock;
