const SURVEY_ASSIGNMENTS_CHANGED_EVENT = 'survey-assignments:changed';

type SurveyAssignmentsChangedReason =
  | 'admin_assignment_saved'
  | 'learner_submission_completed'
  | 'manual_refresh';

type SurveyAssignmentsChangedPayload = {
  reason: SurveyAssignmentsChangedReason;
  surveyId?: string | null;
  assignmentId?: string | null;
  at: string;
};

const toPayload = (payload: Omit<SurveyAssignmentsChangedPayload, 'at'>): SurveyAssignmentsChangedPayload => ({
  ...payload,
  at: new Date().toISOString(),
});

export const emitSurveyAssignmentsChanged = (payload: Omit<SurveyAssignmentsChangedPayload, 'at'>) => {
  if (typeof window === 'undefined') return;
  const detail = toPayload(payload);
  window.dispatchEvent(new CustomEvent(SURVEY_ASSIGNMENTS_CHANGED_EVENT, { detail }));
};

export const subscribeSurveyAssignmentsChanged = (
  listener: (payload: SurveyAssignmentsChangedPayload) => void,
) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<SurveyAssignmentsChangedPayload>;
    if (!customEvent?.detail) return;
    listener(customEvent.detail);
  };

  window.addEventListener(SURVEY_ASSIGNMENTS_CHANGED_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(SURVEY_ASSIGNMENTS_CHANGED_EVENT, handler as EventListener);
  };
};
