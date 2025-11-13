// Thin DAL facade for batchService to keep UI layers from importing services directly.
// This file is intentionally small and mirrors the existing service API.
import { batchService } from '../services/batchService'

export { batchService }
export default batchService
