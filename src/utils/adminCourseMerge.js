import { calculateCourseDuration, countTotalLessons } from '../store/courseStore';
export const formatMinutesLabel = (minutes) => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return '0 min';
    }
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
};
export const mapPersistedLessonType = (persistedType, fallback) => {
    if (fallback)
        return fallback;
    switch (persistedType) {
        case 'resource':
            return 'interactive';
        case 'reflection':
            return 'text';
        default:
            return persistedType;
    }
};
export const mergePersistedCourse = (local, persisted) => {
    const localModules = new Map((local.modules || []).map((module) => [module.id, module]));
    const mergedModules = (persisted.modules || []).map((pModule, moduleIndex) => {
        const existingModule = localModules.get(pModule.id) || (local.modules || [])[moduleIndex];
        const localLessons = new Map((existingModule?.lessons || []).map((lesson) => [lesson.id, lesson]));
        const mergedLessons = (pModule.lessons || []).map((pLesson, lessonIndex) => {
            const existingLesson = localLessons.get(pLesson.id) || (existingModule?.lessons || [])[lessonIndex];
            const estimatedMinutes = existingLesson?.estimatedDuration ??
                (typeof pLesson.durationSeconds === 'number'
                    ? Math.max(0, Math.round(pLesson.durationSeconds / 60))
                    : undefined);
            return {
                ...existingLesson,
                id: pLesson.id,
                title: pLesson.title,
                description: existingLesson?.description ?? '',
                type: mapPersistedLessonType(pLesson.type, existingLesson?.type),
                duration: existingLesson?.duration ?? formatMinutesLabel(estimatedMinutes ?? 0),
                estimatedDuration: existingLesson?.estimatedDuration ?? estimatedMinutes,
                content: existingLesson?.content ?? (pLesson.content?.body ?? {}),
                order: pLesson.orderIndex ?? lessonIndex + 1,
                resources: existingLesson?.resources ?? [],
                completed: existingLesson?.completed ?? false,
            };
        });
        const moduleMinutes = mergedLessons.reduce((total, lesson) => total + (lesson.estimatedDuration ?? 0), 0);
        return {
            ...existingModule,
            id: pModule.id,
            title: pModule.title,
            description: pModule.description ?? existingModule?.description ?? '',
            duration: existingModule?.duration ?? formatMinutesLabel(moduleMinutes),
            order: pModule.orderIndex ?? moduleIndex + 1,
            lessons: mergedLessons,
            resources: existingModule?.resources ?? [],
        };
    });
    return {
        ...local,
        id: persisted.id,
        slug: persisted.slug ?? local.slug,
        title: persisted.name ?? local.title,
        status: persisted.status,
        modules: mergedModules,
        duration: calculateCourseDuration(mergedModules),
        lessons: countTotalLessons(mergedModules),
        lastUpdated: new Date().toISOString(),
    };
};
