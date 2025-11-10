import { certificateService } from '../services/certificateService';
export const generateCertificate = (userId, userName, userEmail, course, completionData) => certificateService.generateCertificate(userId, userName, userEmail, course, completionData);
export const generateFromCompletion = (payload) => certificateService.generateFromCompletion(payload);
export const getAllCertificates = () => certificateService.getAllCertificates();
export const getCertificatesByUser = (userId) => certificateService.getCertificatesByUser(userId);
export const getCertificatesByCourse = (courseId) => certificateService.getCertificatesByCourse(courseId);
export const verifyCertificate = (verificationCode) => certificateService.verifyCertificate(verificationCode);
export const deliverCertificate = (certificate) => certificateService.deliverCertificate(certificate);
export const updateDeliverySettings = (settings) => certificateService.updateDeliverySettings(settings);
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
