// Thin DAL facade over sync service.
//
// IMPORTANT: Avoid re-export syntax (`export { x } from '...'`) here because it
// can trigger Rollup "reexported through module" circular-chunk warnings when
// combined with manual chunking. Use explicit imports + exports instead.
import { syncService, useSyncService } from '../services/syncService';

export { syncService, useSyncService };
