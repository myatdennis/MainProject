import { scrubDiagnosticsPayload } from './scrubDiagnosticsPayload.js';

const ORIGIN_NOT_ALLOWED_REASON = 'origin_not_allowed';

export const buildHealthResponse = ({
  basePayload,
  wantsDiagnostics,
  diagnosticsAllowed,
  diagnosticsPayload,
  denialReason = ORIGIN_NOT_ALLOWED_REASON,
}) => {
  if (!wantsDiagnostics) {
    return { ...basePayload };
  }

  if (!diagnosticsAllowed) {
    return {
      ...basePayload,
      diagnostics: null,
      diagnosticsDenied: true,
      reason: denialReason,
    };
  }

  const sanitizedDiagnostics =
    typeof diagnosticsPayload === 'undefined' || diagnosticsPayload === null
      ? null
      : scrubDiagnosticsPayload(diagnosticsPayload);

  return {
    ...basePayload,
    diagnostics: sanitizedDiagnostics,
  };
};

export default buildHealthResponse;
