export type { DraftSnapshot, SaveDraftOptions, DraftFilter } from '../services/courseDraftStorage';

export {
  saveDraftSnapshot,
  markDraftSynced,
  deleteDraftSnapshot,
  getDraftSnapshot,
  listDraftSnapshots,
} from '../services/courseDraftStorage';
