import { useEffect, useRef, useState } from 'react';
import { Course } from '../types/courseTypes';
import { CourseService } from '../services/courseService';
import { validateCourse } from '../utils/courseValidation';

export type AutosaveStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'error'
  | 'offline'
  | 'invalid';

export interface UseCourseAutosaveOptions {
  intervalMs?: number;
  enabled?: boolean;
  skipValidation?: boolean;
  onAfterSave?: (course: Course) => void;
  onValidationFailed?: (issues: string[]) => void;
}

export interface AutosaveState {
  status: AutosaveStatus;
  message: string;
  lastSavedAt: Date | null;
  pendingChanges: boolean;
  error?: string;
  validationIssues?: string[];
}

interface InternalSnapshot {
  serialized: string;
  course: Course;
}

const OFFLINE_MESSAGE = 'Connection lost — pending changes will sync when back online.';

export const useCourseAutosave = (
  course: Course,
  options: UseCourseAutosaveOptions = {}
) => {
  const { intervalMs = 10000, enabled = true, skipValidation = false, onAfterSave, onValidationFailed } = options;

  const [autosaveState, setAutosaveState] = useState<AutosaveState>({
    status: 'idle',
    message: 'Autosave ready',
    lastSavedAt: null,
    pendingChanges: false
  });

  const courseRef = useRef<Course>(course);
  const lastSavedSnapshotRef = useRef<InternalSnapshot>({ serialized: JSON.stringify(course), course });
  const pendingSnapshotRef = useRef<InternalSnapshot | null>(null);
  const isSavingRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    courseRef.current = course;
    const serialized = JSON.stringify(course);

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSavedSnapshotRef.current = { serialized, course };
      return;
    }

    if (serialized !== lastSavedSnapshotRef.current.serialized) {
      pendingSnapshotRef.current = { serialized, course };
      setAutosaveState(prev => ({
        ...prev,
        status: 'dirty',
        message: 'Unsaved changes',
        pendingChanges: true,
        error: undefined,
        validationIssues: undefined
      }));
    }
  }, [course]);

  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => {
      setAutosaveState(prev => {
        if (prev.status === 'offline') {
          return {
            ...prev,
            status: 'dirty',
            message: 'Connection restored. Pending changes will sync shortly.'
          };
        }
        return prev;
      });
    };

    const handleOffline = () => {
      setAutosaveState(prev => ({
        ...prev,
        status: 'offline',
        message: OFFLINE_MESSAGE,
        error: undefined
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const intervalId = window.setInterval(async () => {
      if (!pendingSnapshotRef.current) return;
      if (pendingSnapshotRef.current.serialized === lastSavedSnapshotRef.current.serialized) return;
      if (isSavingRef.current) return;

      if (!navigator.onLine) {
        setAutosaveState(prev => ({
          ...prev,
          status: 'offline',
          message: OFFLINE_MESSAGE
        }));
        return;
      }

      const currentCourse = courseRef.current;

      if (!skipValidation) {
        const validation = validateCourse(currentCourse);
        if (!validation.isValid) {
          setAutosaveState(prev => ({
            ...prev,
            status: 'invalid',
            message: validation.issues[0] || 'Course validation issues detected',
            validationIssues: validation.issues,
            pendingChanges: true
          }));
          onValidationFailed?.(validation.issues);
          return;
        }
      }

      isSavingRef.current = true;
      setAutosaveState(prev => ({
        ...prev,
        status: 'saving',
        message: 'Saving changes…',
        error: undefined,
        validationIssues: undefined
      }));

      try {
        await CourseService.syncCourseToDatabase(currentCourse);
        const timestamp = new Date();
        lastSavedSnapshotRef.current = pendingSnapshotRef.current;
        pendingSnapshotRef.current = null;
        setAutosaveState({
          status: 'saved',
          message: 'All changes saved',
          lastSavedAt: timestamp,
          pendingChanges: false
        });
        onAfterSave?.(currentCourse);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save changes';
        setAutosaveState(prev => ({
          ...prev,
          status: 'error',
          message,
          error: message,
          pendingChanges: true
        }));
      } finally {
        isSavingRef.current = false;
      }
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, skipValidation, onAfterSave, onValidationFailed]);

  const markAsSaved = (savedCourse: Course) => {
    const serialized = JSON.stringify(savedCourse);
    lastSavedSnapshotRef.current = { serialized, course: savedCourse };
    pendingSnapshotRef.current = null;
    const timestamp = new Date();
    setAutosaveState({
      status: 'saved',
      message: 'All changes saved',
      lastSavedAt: timestamp,
      pendingChanges: false
    });
  };

  const markAsPending = () => {
    const serialized = JSON.stringify(courseRef.current);
    pendingSnapshotRef.current = { serialized, course: courseRef.current };
    setAutosaveState(prev => ({
      ...prev,
      status: 'dirty',
      message: 'Unsaved changes',
      pendingChanges: true
    }));
  };

  return {
    autosaveState,
    markAsSaved,
    markAsPending
  };
};
