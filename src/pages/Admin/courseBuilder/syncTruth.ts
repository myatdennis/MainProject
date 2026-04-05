export type CourseSyncTruthState = 'publish_blocked' | 'syncing' | 'failed' | 'local_only' | 'synced';

export type CourseSyncTruth = {
  state: CourseSyncTruthState;
  label: string;
  detail: string;
  tone: string;
  dot: string;
};

type ResolveCourseSyncTruthInput = {
  validationIsValid: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lessonAutosavePending: boolean;
  lessonAutosaveStatus: 'idle' | 'saving' | 'error';
  supabaseConnected: boolean;
  hasDraftSnapshotPrompt: boolean;
  hasPendingChanges: boolean;
  lastSaveTime: Date | null;
};

export const resolveCourseSyncTruth = ({
  validationIsValid,
  saveStatus,
  lessonAutosavePending,
  lessonAutosaveStatus,
  supabaseConnected,
  hasDraftSnapshotPrompt,
  hasPendingChanges,
  lastSaveTime,
}: ResolveCourseSyncTruthInput): CourseSyncTruth => {
  if (!validationIsValid) {
    return {
      state: 'publish_blocked',
      label: 'Publish blocked',
      detail: 'Resolve validation blockers before this draft can be published.',
      tone: 'text-amber-700',
      dot: 'bg-amber-500',
    };
  }

  if (saveStatus === 'saving' || lessonAutosavePending || lessonAutosaveStatus === 'saving') {
    return {
      state: 'syncing',
      label: 'Syncing',
      detail: 'Changes are being written to Huddle now.',
      tone: 'text-blue-600',
      dot: 'bg-blue-500',
    };
  }

  if (saveStatus === 'error') {
    return {
      state: 'failed',
      label: 'Sync failed',
      detail: 'The latest save did not reach Huddle. Review the error banner and retry.',
      tone: 'text-red-600',
      dot: 'bg-red-500',
    };
  }

  if (!supabaseConnected || hasDraftSnapshotPrompt || hasPendingChanges) {
    return {
      state: 'local_only',
      label: 'Local only',
      detail: !supabaseConnected
        ? 'Changes are stored locally until the backend is healthy again.'
        : 'You have local changes that have not reached Huddle yet.',
      tone: 'text-amber-600',
      dot: 'bg-amber-500',
    };
  }

  return {
    state: 'synced',
    label: 'Synced',
    detail: lastSaveTime
      ? `Last synced at ${lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
      : 'Draft is synced with Huddle.',
    tone: 'text-green-600',
    dot: 'bg-green-500',
  };
};
