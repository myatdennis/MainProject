import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CourseProgressSidebar from '../CourseProgressSidebar';

const buildCourse = () => ({
  id: 'course-1',
  title: 'Course',
  modules: [
    {
      id: 'module-2',
      title: 'Module 2',
      order: 10,
      order_index: 2,
      lessons: [
        {
          id: 'lesson-2b',
          title: 'Lesson 2B',
          type: 'text' as const,
          order: 10,
          order_index: 2,
        },
        {
          id: 'lesson-2a',
          title: 'Lesson 2A',
          type: 'video' as const,
          order: 99,
          order_index: 1,
        },
      ],
    },
    {
      id: 'module-1',
      title: 'Module 1',
      order: 99,
      order_index: 1,
      lessons: [
        {
          id: 'lesson-1a',
          title: 'Lesson 1A',
          type: 'video' as const,
          order: 1,
          order_index: 1,
        },
      ],
    },
  ],
});

describe('CourseProgressSidebar', () => {
  it('sorts modules/lessons by order_index and stays synced to current lesson module', () => {
    render(
      <CourseProgressSidebar
        course={buildCourse()}
        currentLessonId="lesson-2a"
        lessonProgress={{}}
        onLessonSelect={vi.fn()}
      />,
    );

    const moduleHeaders = screen.getAllByRole('button').filter((button) =>
      button.textContent?.includes('Module '),
    );

    expect(moduleHeaders[0]).toHaveTextContent('Module 1: Module 1');
    expect(moduleHeaders[1]).toHaveTextContent('Module 2: Module 2');

    const moduleTwoPanel = moduleHeaders[1].closest('div');
    expect(moduleTwoPanel).toBeTruthy();

    const lessonItems = screen.getAllByRole('button').filter((button) =>
      /Lesson 2A|Lesson 2B/.test(button.textContent || ''),
    );
    expect(lessonItems[0]).toHaveTextContent('1. Lesson 2A');
    expect(lessonItems[1]).toHaveTextContent('2. Lesson 2B');
  });

  it('keeps sidebar and player intent synced when a lesson is clicked', async () => {
    const onLessonSelect = vi.fn();
    const onLessonOpenInPlayer = vi.fn();

    render(
      <CourseProgressSidebar
        course={buildCourse()}
        currentLessonId="lesson-1a"
        lessonProgress={{}}
        onLessonSelect={onLessonSelect}
        onLessonOpenInPlayer={onLessonOpenInPlayer}
      />,
    );

    const moduleTwoHeader = screen.getByRole('button', { name: /Module 2: Module 2/i });
    await userEvent.click(moduleTwoHeader);

    const lessonButton = screen.getByRole('button', { name: /Lesson 2A/i });
    await userEvent.click(lessonButton);

    expect(onLessonSelect).toHaveBeenCalledWith('module-2', 'lesson-2a');

    const launchButtons = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('title') === 'Open lesson in Course Player');
    await userEvent.click(launchButtons[0]);

    expect(onLessonOpenInPlayer).toHaveBeenCalled();
  });
});
