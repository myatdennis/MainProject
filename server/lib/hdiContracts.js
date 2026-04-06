export const HDI_METADATA_CONTRACT_VERSION = '2026-04-hdi-v1';

const asTrimmedString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeHdiAdministrationType = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'pre') return 'pre';
  if (normalized === 'post') return 'post';
  if (normalized === 'pulse' || normalized === 'follow-up' || normalized === 'followup') return 'pulse';
  return 'single';
};

export const normalizeHdiLinkedAssessmentId = (value) => asTrimmedString(value);

export const extractStableParticipantKeys = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') return [];
  const participant =
    metadata.participant && typeof metadata.participant === 'object' ? metadata.participant : {};
  const keys = [
    metadata.userId,
    metadata.user_id,
    metadata.participantKey,
    metadata.participant_key,
    participant.key,
    metadata.email,
    participant.email,
    metadata.confidentialCode,
    metadata.confidential_code,
    participant.confidentialCode,
  ];

  return Array.from(
    new Set(
      keys
        .filter((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)
        .map((candidate) => candidate.trim().toLowerCase()),
    ),
  );
};

export const buildParticipantIdentity = ({ userId = null, userEmail = null, metadata = {}, assignmentMetadata = {} } = {}) => {
  const explicitParticipantKey =
    asTrimmedString(metadata?.participantKey) ||
    asTrimmedString(metadata?.participant_key) ||
    asTrimmedString(assignmentMetadata?.participantKey) ||
    asTrimmedString(assignmentMetadata?.participant_key);

  const participantKeys = Array.from(
    new Set(
      [
        asTrimmedString(userId),
        asTrimmedString(userEmail),
        ...extractStableParticipantKeys(assignmentMetadata),
        ...extractStableParticipantKeys(metadata),
      ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase()),
    ),
  );

  return {
    participantKey: explicitParticipantKey,
    participantKeys,
  };
};

export const validateHdiSubmissionContract = ({ administrationType, linkedAssessmentId, participantKeys = [] } = {}) => {
  const normalizedAdministrationType = normalizeHdiAdministrationType(administrationType);
  const normalizedLinkedAssessmentId = normalizeHdiLinkedAssessmentId(linkedAssessmentId);
  const safeKeys = Array.isArray(participantKeys)
    ? participantKeys.filter((value) => typeof value === 'string' && value.trim().length > 0)
    : [];

  if (normalizedAdministrationType === 'pre' && normalizedLinkedAssessmentId) {
    return {
      ok: false,
      code: 'invalid_hdi_linking',
      message: 'Pre assessments cannot include linkedAssessmentId.',
    };
  }

  if (normalizedAdministrationType === 'post' && safeKeys.length === 0) {
    return {
      ok: false,
      code: 'missing_hdi_participant_identity',
      message: 'Post assessments require participant identity keys for deterministic pre/post matching.',
    };
  }

  return {
    ok: true,
    code: null,
    message: null,
    administrationType: normalizedAdministrationType,
    linkedAssessmentId: normalizedLinkedAssessmentId,
    participantKeys: safeKeys,
  };
};
