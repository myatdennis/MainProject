// Thin DAL facade over certificate service to centralize imports
import type { Course } from '../types/courseTypes';
import { certificateService } from '../services/certificateService';

export type { CertificateCompletionPayload, CertificateTemplate, GeneratedCertificate, CertificateDelivery } from '../services/certificateService';

export const generateCertificate = (
  userId: string,
  userName: string,
  userEmail: string,
  course: Course,
  completionData: {
    completionDate: string;
    completionTime: string;
    finalScore?: number;
    requirementsMet: string[];
  },
) => certificateService.generateCertificate(userId, userName, userEmail, course, completionData);

export const generateFromCompletion = (payload: import('../services/certificateService').CertificateCompletionPayload) =>
  certificateService.generateFromCompletion(payload);

export const getAllCertificates = () => certificateService.getAllCertificates();
export const getCertificatesByUser = (userId: string) => certificateService.getCertificatesByUser(userId);
export const getCertificatesByCourse = (courseId: string) => certificateService.getCertificatesByCourse(courseId);

export const verifyCertificate = (verificationCode: string) => certificateService.verifyCertificate(verificationCode);
export const deliverCertificate = (certificate: import('../services/certificateService').GeneratedCertificate) => certificateService.deliverCertificate(certificate);

export const updateDeliverySettings = (settings: Partial<import('../services/certificateService').CertificateDelivery>) =>
  certificateService.updateDeliverySettings(settings);
export const getDeliverySettings = () => certificateService.getDeliverySettings();

export default {
  generateCertificate,
  generateFromCompletion,
  getAllCertificates,
  getCertificatesByUser,
  getCertificatesByCourse,
  verifyCertificate,
  deliverCertificate,
  updateDeliverySettings,
  getDeliverySettings,
};
