import type { AdminReflectionRow } from '../services/reflectionService';

export const buildReflectionSections = (row: Pick<AdminReflectionRow, 'responseData' | 'responseText'>) => {
  const responseData = row.responseData;
  if (responseData) {
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
