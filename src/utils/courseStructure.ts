import { Chapter, Course, Lesson } from '../types/courseTypes';
import { formatMinutes, parseDurationToMinutes } from './courseNormalization';

export const recalculateCourseDurations = (course: Course): Course => {
  const chapters = (course.chapters || []).map((chapter, chapterIndex) => {
    const lessons = (chapter.lessons || []).map((lesson, lessonIndex) => ({
      ...lesson,
      order: lesson.order ?? lessonIndex + 1,
      estimatedDuration: lesson.estimatedDuration ?? 0,
      content: {
        ...(lesson.content || {}),
      },
    }));

    const estimatedDuration = lessons.reduce((sum, lesson) => {
      return sum + (lesson.estimatedDuration || 0);
    }, 0);

    return {
      ...chapter,
      order: chapter.order ?? chapterIndex + 1,
      lessons,
      estimatedDuration,
    };
  });

  const totalMinutes = chapters.reduce((sum, chapter) => {
    return sum + (chapter.estimatedDuration || 0);
  }, 0);

  return {
    ...course,
    chapters,
    estimatedDuration: totalMinutes,
    duration: formatMinutes(totalMinutes) || `${totalMinutes} min`,
  };
};

export const convertModulesToChapters = (course: Course): Course => {
  if (course.chapters && course.chapters.length > 0) {
    return recalculateCourseDurations(course);
  }

  const modules = course.modules || [];
  const chapters: Chapter[] = modules.map((module, moduleIndex) => {
    const lessons = (module.lessons || []).map((lesson, lessonIndex) => {
      const estimated =
        lesson.estimatedDuration ??
        parseDurationToMinutes(lesson.duration) ??
        (lesson.content?.videoDuration ? Math.round(lesson.content.videoDuration / 60) : 0);

      return {
        ...lesson,
        chapterId: module.id,
        order: lesson.order ?? lessonIndex + 1,
        estimatedDuration: Number.isFinite(estimated) ? estimated : 0,
        content: {
          ...(lesson.content || {}),
        },
      } as Lesson;
    });

    const estimatedDuration = lessons.reduce((total, l) => total + (l.estimatedDuration || 0), 0);

    return {
      id: module.id,
      courseId: course.id,
      title: module.title,
      description: module.description,
      order: module.order ?? moduleIndex + 1,
      estimatedDuration,
      lessons,
    };
  });

  return recalculateCourseDurations({
    ...course,
    chapters,
  });
};

export const buildModulesFromChapters = (course: Course): Course => {
  const chapters = course.chapters || [];
  const modules = chapters.map((chapter, chapterIndex) => {
    const lessons = (chapter.lessons || []).map((lesson, lessonIndex) => {
      const estimated = lesson.estimatedDuration ?? 0;
      return {
        ...lesson,
        order: lesson.order ?? lessonIndex + 1,
        chapterId: chapter.id,
        duration: lesson.duration || formatMinutes(estimated) || `${estimated} min`,
        content: {
          ...(lesson.content || {}),
        },
      };
    });

    const chapterMinutes =
      chapter.estimatedDuration ??
      lessons.reduce((sum, item) => {
        return sum + (item.estimatedDuration || 0);
      }, 0);

    return {
      id: chapter.id,
      title: chapter.title,
      description: chapter.description,
      order: chapter.order ?? chapterIndex + 1,
      lessons,
      duration: formatMinutes(chapterMinutes) || `${chapterMinutes} min`,
    };
  });

  const totalMinutes = chapters.reduce((sum, chapter) => sum + (chapter.estimatedDuration || 0), 0);
  const totalLessons = modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0);

  return {
    ...course,
    modules,
    chapters,
    estimatedDuration: totalMinutes,
    duration: formatMinutes(totalMinutes) || `${totalMinutes} min`,
    lessons: totalLessons,
  };
};
