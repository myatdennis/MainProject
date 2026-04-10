import type { AdminReflectionRow } from '../services/reflectionService';
import { normalizeReflectionResponseData } from './reflectionFlow';

export const buildReflectionSections = (row: Pick<AdminReflectionRow, 'responseData' | 'responseText'>) => {
  const responseDataRaw = row.responseData;
  if (responseDataRaw) {
    const responseData = normalizeReflectionResponseData(responseDataRaw as any);
    const answers = responseData.answers ?? {};
    const preferredOrder =
      (Array.isArray(responseData.stepOrder) && responseData.stepOrder.length > 0 ? responseData.stepOrder : null) ??
      null;
    const orderedKeys = preferredOrder ?? Object.keys(answers);
    const keyLabel = (key: string) => {
      switch (key) {
        case 'promptResponse':
          return 'Prompt Response';
        case 'deeperReflection1':
          return 'Deeper Reflection 1';
        case 'deeperReflection2':
          return 'Deeper Reflection 2';
        case 'deeperReflection3':
          return 'Deeper Reflection 3';
        case 'actionCommitment':
          return 'Action Commitment';
        default:
          return key;
      }
    };

    const sections = orderedKeys
      .map((key) => ({ label: keyLabel(key), value: answers[key] }))
      .filter((section) => section.value && section.value.trim().length > 0);

    // Fallback to legacy keys if answers were not present (older responses).
    if (sections.length > 0) return sections;

    return [
      { label: 'Prompt Response', value: responseData.promptResponse },
      { label: 'Deeper Reflection 1', value: responseData.deeperReflection1 },
      { label: 'Deeper Reflection 2', value: responseData.deeperReflection2 },
      { label: 'Deeper Reflection 3', value: responseData.deeperReflection3 },
      { label: 'Action Commitment', value: responseData.actionCommitment },
    ].filter((section) => section.value && section.value.trim().length > 0);
  }
  return row.responseText?.trim()
    ? [{ label: 'Prompt Response', value: row.responseText }]
    : [];
};
