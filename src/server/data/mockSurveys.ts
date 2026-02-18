import { randomUUID } from 'crypto';
import type { Survey, SurveyStatus } from '../../types/survey.js';

export interface SurveyUpsertInput extends Partial<Survey> {
  id?: string;
  title: string;
  status?: SurveyStatus;
}

const surveys = new Map<string, Survey>();
const surveyResponses = new Map<string, Array<{ id: string; userId?: string; submittedAt: string; payload: unknown }>>();

const seedSurveys: Survey[] = [
  {
    id: 'pulse-2025',
    title: '2025 DEI Pulse Check',
    description: 'Quick quarterly sentiment survey for the leadership cohort.',
    status: 'published',
    version: 1,
    createdBy: 'Avery Chen',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blocks: [],
    sections: [],
    settings: {
      anonymityMode: 'anonymous',
      anonymityThreshold: 5,
      allowMultipleResponses: false,
      showProgressBar: true,
      consentRequired: true,
      allowAnonymous: true,
      allowSaveAndContinue: true,
      randomizeQuestions: false,
      randomizeOptions: false,
    },
    branding: {
      primaryColor: '#2f80ed',
      secondaryColor: '#56ccf2',
      logo: '',
    },
    defaultLanguage: 'en',
    supportedLanguages: ['en'],
    completionSettings: {
      thankYouMessage: 'Thanks for sharing your perspective!',
      showResources: true,
      recommendedCourses: ['foundations-inclusive-leadership'],
    },
    assignedTo: {
      organizationIds: ['org-huddle'],
    },
    reflectionPrompts: ['What energized you this quarter?'],
  },
];

seedSurveys.forEach((survey) => surveys.set(survey.id, survey));

export const listSurveys = (status?: SurveyStatus): Survey[] => {
  const all = Array.from(surveys.values());
  return status ? all.filter((survey) => survey.status === status) : all;
};

export const getSurveyById = (id: string): Survey | undefined => surveys.get(id);

export const upsertSurvey = (input: SurveyUpsertInput): Survey => {
  const surveyId = input.id ?? randomUUID();
  const existing = surveys.get(surveyId);
  const survey: Survey = {
    id: surveyId,
    title: input.title,
    description: input.description ?? existing?.description ?? '',
    status: input.status ?? existing?.status ?? 'draft',
    version: existing?.version ?? 1,
    createdBy: input.createdBy ?? existing?.createdBy ?? 'The Huddle Co.',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blocks: input.blocks ?? existing?.blocks ?? [],
    sections: input.sections ?? existing?.sections ?? [],
    settings: input.settings ??
      existing?.settings ?? {
        anonymityMode: 'anonymous',
        anonymityThreshold: 5,
        allowMultipleResponses: false,
        showProgressBar: true,
        consentRequired: true,
        allowAnonymous: true,
        allowSaveAndContinue: true,
        randomizeQuestions: false,
        randomizeOptions: false,
      },
    branding: input.branding ??
      existing?.branding ?? {
        primaryColor: '#2f80ed',
        secondaryColor: '#56ccf2',
        logo: '',
      },
    defaultLanguage: input.defaultLanguage ?? existing?.defaultLanguage ?? 'en',
    supportedLanguages: input.supportedLanguages ?? existing?.supportedLanguages ?? ['en'],
    completionSettings: input.completionSettings ?? existing?.completionSettings ?? {
      thankYouMessage: 'Thank you for completing the survey!',
      showResources: true,
      recommendedCourses: [],
    },
    assignedTo: input.assignedTo ?? existing?.assignedTo ?? { organizationIds: [] },
    reflectionPrompts: input.reflectionPrompts ?? existing?.reflectionPrompts ?? [],
  };

  surveys.set(surveyId, survey);
  return survey;
};

export const recordSurveyResponse = (surveyId: string, payload: unknown, userId?: string) => {
  const responses = surveyResponses.get(surveyId) ?? [];
  responses.push({ id: randomUUID(), userId, payload, submittedAt: new Date().toISOString() });
  surveyResponses.set(surveyId, responses);
  return { totalResponses: responses.length };
};

export const listSurveyResponses = (surveyId: string) => surveyResponses.get(surveyId) ?? [];
