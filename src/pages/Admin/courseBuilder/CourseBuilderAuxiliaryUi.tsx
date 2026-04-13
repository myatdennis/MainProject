import CourseAssignmentModal from '../../../components/CourseAssignmentModal';
import LivePreview from '../../../components/LivePreview';
import CoursePreviewDock from '../../../components/preview/CoursePreviewDock';
import MobileCourseToolbar from '../../../components/Admin/MobileCourseToolbar';
import { CourseBuilderConfirmDialog, CourseBuilderValidationModal, type ConfirmDialogConfig } from './CourseBuilderChrome';
import type { Course, Module, Lesson } from '../../../types/courseTypes';
import type { CourseValidationIssue } from '../../../validation/courseValidation';

interface CourseBuilderPreviewDockProps {
  course: Course;
  activeLessonId: string | null;
  onLaunchFullPreview: () => void;
}

export const CourseBuilderPreviewDockPanel = ({
  course,
  activeLessonId,
  onLaunchFullPreview,
}: CourseBuilderPreviewDockProps) => (
  <div className="order-1 xl:order-2 w-full">
    <CoursePreviewDock course={course} activeLessonId={activeLessonId} onLaunchFullPreview={onLaunchFullPreview} />
  </div>
);

interface CourseBuilderMobileActionsProps {
  isVisible: boolean;
  onAddModule: () => void;
  onPreview: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onAssign: () => void;
  onPublish: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  hasPendingChanges: boolean;
  lastSaved: Date | null;
  disabled: boolean;
  saveDisabled: boolean;
  saveTitle?: string;
  saveLabel?: string;
  publishDisabled: boolean;
  publishTitle?: string;
}

export const CourseBuilderMobileActions = ({
  isVisible,
  onAddModule,
  onPreview,
  onSave,
  onAssign,
  onPublish,
  saveStatus,
  hasPendingChanges,
  lastSaved,
  disabled,
  saveDisabled,
  saveTitle,
  saveLabel,
  publishDisabled,
  publishTitle,
}: CourseBuilderMobileActionsProps) => {
  if (!isVisible) {
    return null;
  }

  return (
    <MobileCourseToolbar
      onAddModule={onAddModule}
      onPreview={() => void onPreview()}
      onSave={() => void onSave()}
      onAssign={onAssign}
      onPublish={onPublish}
      saveStatus={saveStatus}
      hasPendingChanges={hasPendingChanges}
      lastSaved={lastSaved}
      disabled={disabled}
      saveDisabled={saveDisabled}
      saveTitle={saveTitle}
      saveLabel={saveLabel}
      publishDisabled={publishDisabled}
      publishTitle={publishTitle}
    />
  );
};

interface CourseBuilderModalsProps {
  course: Course;
  showAssignmentModal: boolean;
  onCloseAssignmentModal: () => void;
  onAssignComplete: () => void;
  showPreview: boolean;
  onClosePreview: () => void;
  currentModule?: Module;
  currentLesson?: Lesson;
  confirmDialogContent: ConfirmDialogConfig | null;
  onCloseConfirmDialog: () => void;
  onConfirmAction: () => void;
  isValidationModalOpen: boolean;
  activeValidationIntent: 'draft' | 'publish';
  validationIssues: CourseValidationIssue[];
  onCloseValidationModal: () => void;
  onFixValidationIssue: (issue: CourseValidationIssue) => void;
}

export const CourseBuilderModals = ({
  course,
  showAssignmentModal,
  onCloseAssignmentModal,
  onAssignComplete,
  showPreview,
  onClosePreview,
  currentModule,
  currentLesson,
  confirmDialogContent,
  onCloseConfirmDialog,
  onConfirmAction,
  isValidationModalOpen,
  activeValidationIntent,
  validationIssues,
  onCloseValidationModal,
  onFixValidationIssue,
}: CourseBuilderModalsProps) => (
  <>
    <CourseAssignmentModal
      isOpen={showAssignmentModal}
      onClose={onCloseAssignmentModal}
      onAssignComplete={onAssignComplete}
      selectedUsers={[]}
      course={{
        id: course.id,
        title: course.title,
        duration: course.duration,
        organizationId: course.organizationId ?? null,
      }}
    />
    <LivePreview
      isOpen={showPreview}
      onClose={onClosePreview}
      course={course}
      currentModule={currentModule}
      currentLesson={currentLesson}
    />
    <CourseBuilderConfirmDialog
      config={confirmDialogContent}
      onClose={onCloseConfirmDialog}
      onConfirm={onConfirmAction}
    />
    <CourseBuilderValidationModal
      isOpen={isValidationModalOpen}
      activeValidationIntent={activeValidationIntent}
      validationIssues={validationIssues}
      onClose={onCloseValidationModal}
      onFix={onFixValidationIssue}
    />
  </>
);
