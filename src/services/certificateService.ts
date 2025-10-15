/**
 * 🏆 Certificate Auto-Generation Service
 * 
 * Handles automatic certificate creation, template management, and delivery
 * when learners complete courses that offer certification.
 */

import { Course } from '../types/courseTypes';

export interface CertificateTemplate {
  id: string;
  name: string;
  type: 'professional' | 'modern' | 'classic' | 'executive';
  design: {
    primaryColor: string;
    secondaryColor: string;
    logo: string;
    background: string;
    font: string;
  };
  layout: {
    titlePosition: 'center' | 'top' | 'custom';
    signaturePosition: 'bottom' | 'right' | 'custom';
    logoPosition: 'top-left' | 'top-center' | 'top-right';
  };
  elements: {
    showBorder: boolean;
    showSeal: boolean;
    showWatermark: boolean;
    showQRCode: boolean;
  };
}

export interface GeneratedCertificate {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseName: string;
  certificateName: string;
  templateId: string;
  generatedAt: string;
  completionDate: string;
  validUntil?: string;
  certificateUrl: string;
  verificationCode: string;
  status: 'generated' | 'sent' | 'verified' | 'expired';
  metadata: {
    completionTime: string;
    finalScore?: number;
    requirements: string[];
    instructorName: string;
    organizationName: string;
  };
}

export interface CertificateDelivery {
  method: 'email' | 'download' | 'both';
  emailTemplate: string;
  autoSend: boolean;
  includeTranscript: boolean;
  notifyAdmin: boolean;
}

class CertificateService {
  private certificates: Map<string, GeneratedCertificate> = new Map();
  private templates: Map<string, CertificateTemplate> = new Map();
  private deliverySettings: CertificateDelivery;

  constructor() {
    this.loadStoredCertificates();
    this.loadDefaultTemplates();
    this.deliverySettings = {
      method: 'both',
      emailTemplate: 'professional',
      autoSend: true,
      includeTranscript: false,
      notifyAdmin: true
    };
  }

  /**
   * 🎯 Main Function: Auto-generate certificate when course is completed
   */
  async generateCertificate(
    userId: string, 
    userName: string, 
    userEmail: string,
    course: Course,
    completionData: {
      completionDate: string;
      completionTime: string;
      finalScore?: number;
      requirementsMet: string[];
    }
  ): Promise<GeneratedCertificate | null> {
    
    // Verify course offers certification
    if (!course.certification?.available) {
      console.log('Certificate generation skipped - course does not offer certification');
      return null;
    }

    // Verify requirements are met
    const requirementsMet = this.verifyRequirements(course, completionData);
    if (!requirementsMet.allMet) {
      console.log('Certificate generation failed - requirements not met:', requirementsMet.missing);
      return null;
    }

    // Generate unique certificate
    const certificate: GeneratedCertificate = {
      id: this.generateCertificateId(),
      userId,
      userName,
      userEmail,
      courseId: course.id,
      courseName: course.title,
      certificateName: course.certification.name,
      templateId: this.selectOptimalTemplate(course),
      generatedAt: new Date().toISOString(),
      completionDate: completionData.completionDate,
      validUntil: this.calculateExpirationDate(course.certification.validFor),
      certificateUrl: this.generateCertificateUrl(userId, course.id),
      verificationCode: this.generateVerificationCode(),
      status: 'generated',
      metadata: {
        completionTime: completionData.completionTime,
        finalScore: completionData.finalScore,
        requirements: completionData.requirementsMet,
        instructorName: course.createdBy || 'Unknown Instructor',
        organizationName: 'The Huddle Co.'
      }
    };

    // Store certificate
    this.certificates.set(certificate.id, certificate);
    this.persistCertificates();

    // Log generation event
    this.logCertificateEvent('generated', certificate);

    // Auto-deliver if enabled
    if (this.deliverySettings.autoSend) {
      await this.deliverCertificate(certificate);
    }

    return certificate;
  }

  /**
   * 📋 Verify course completion requirements
   */
  private verifyRequirements(course: Course, completionData: any) {
    const requirements = course.certification?.requirements || [];
    const met: string[] = [];
    const missing: string[] = [];

    requirements.forEach((requirement: string) => {
      const reqLower = requirement.toLowerCase();
      
      // Check common requirement patterns
      if (reqLower.includes('complete all') && completionData.allModulesCompleted) {
        met.push(requirement);
      } else if (reqLower.includes('pass') && reqLower.includes('%')) {
        const requiredScore = this.extractPercentage(requirement);
        if (completionData.finalScore >= requiredScore) {
          met.push(requirement);
        } else {
          missing.push(requirement);
        }
      } else if (reqLower.includes('submit') && completionData.submissionsCompleted) {
        met.push(requirement);
      } else {
        // Default to met for basic completion
        met.push(requirement);
      }
    });

    return {
      allMet: missing.length === 0,
      met,
      missing,
      percentage: requirements.length > 0 ? (met.length / requirements.length) * 100 : 100
    };
  }

  /**
   * 🎨 Select optimal certificate template based on course
   */
  private selectOptimalTemplate(course: Course): string {
    // Professional for leadership courses
    if (course.title.toLowerCase().includes('leadership')) {
      return 'template-professional-a';
    }
    
    // Modern for DEIA/contemporary topics
    if ((course.tags || []).some((tag: string) => ['DEIA', 'Inclusion', 'Diversity'].includes(tag))) {
      return 'template-modern-b';
    }
    
    // Executive for advanced/senior content
    if (course.difficulty === 'Advanced') {
      return 'template-executive-d';
    }
    
    // Default to classic
    return 'template-classic-c';
  }

  /**
   * 📧 Deliver certificate via configured method
   */
  async deliverCertificate(certificate: GeneratedCertificate): Promise<boolean> {
    try {
      const deliveryPromises: Promise<boolean>[] = [];

      if (this.deliverySettings.method === 'email' || this.deliverySettings.method === 'both') {
        deliveryPromises.push(this.sendCertificateEmail(certificate));
      }

      if (this.deliverySettings.method === 'download' || this.deliverySettings.method === 'both') {
        deliveryPromises.push(this.prepareCertificateDownload(certificate));
      }

      const results = await Promise.all(deliveryPromises);
      const success = results.every(result => result);

      if (success) {
        certificate.status = 'sent';
        this.logCertificateEvent('delivered', certificate);
      }

      // Notify admin if enabled
      if (this.deliverySettings.notifyAdmin) {
        this.notifyAdminOfGeneration(certificate);
      }

      return success;
    } catch (error) {
      console.error('Certificate delivery failed:', error);
      return false;
    }
  }

  /**
   * 📧 Send certificate via email
   */
  private async sendCertificateEmail(certificate: GeneratedCertificate): Promise<boolean> {
    const emailContent = this.generateEmailContent(certificate);
    
    // Simulate email sending (replace with actual email service)
    console.log('📧 Sending certificate email to:', certificate.userEmail);
    console.log('Subject:', emailContent.subject);
    console.log('Body preview:', emailContent.body.substring(0, 100) + '...');
    
    // Log to localStorage for demo purposes
    const emailLog = JSON.parse(localStorage.getItem('certificate_emails') || '[]');
    emailLog.push({
      timestamp: new Date().toISOString(),
      recipient: certificate.userEmail,
      certificateId: certificate.id,
      subject: emailContent.subject,
      status: 'sent'
    });
    localStorage.setItem('certificate_emails', JSON.stringify(emailLog));
    
    return true;
  }

  /**
   * 📄 Generate email content for certificate delivery
   */
  private generateEmailContent(certificate: GeneratedCertificate) {
    const subject = `🎉 Congratulations! Your ${certificate.certificateName} is ready`;
    
    const body = `
Dear ${certificate.userName},

Congratulations on completing "${certificate.courseName}"! 🎉

We're pleased to award you the ${certificate.certificateName}. This certificate recognizes your commitment to learning and professional development.

Certificate Details:
• Course: ${certificate.courseName}
• Completed: ${new Date(certificate.completionDate).toLocaleDateString()}
• Certificate ID: ${certificate.verificationCode}
• Valid Until: ${certificate.validUntil ? new Date(certificate.validUntil).toLocaleDateString() : 'No expiration'}

You can download your certificate at: ${certificate.certificateUrl}

Requirements Met:
${certificate.metadata.requirements.map(req => `✓ ${req}`).join('\n')}

${certificate.metadata.finalScore ? `Final Score: ${certificate.metadata.finalScore}%` : ''}

Thank you for your dedication to learning and growth!

Best regards,
The Learning Team
The Huddle Co.

---
Certificate Verification: Visit our verification portal and enter code ${certificate.verificationCode}
`;

    return { subject, body };
  }

  /**
   * 🔍 Get certificate verification info
   */
  verifyCertificate(verificationCode: string): GeneratedCertificate | null {
    for (const certificate of this.certificates.values()) {
      if (certificate.verificationCode === verificationCode) {
        // Check if expired
        if (certificate.validUntil && new Date(certificate.validUntil) < new Date()) {
          certificate.status = 'expired';
        } else if (certificate.status === 'generated') {
          certificate.status = 'verified';
        }
        return certificate;
      }
    }
    return null;
  }

  /**
   * 📊 Get certificate statistics
   */
  getCertificateStats() {
    const certificates = Array.from(this.certificates.values());
    const now = new Date();
    
    return {
      total: certificates.length,
      active: certificates.filter(c => c.status !== 'expired').length,
      expired: certificates.filter(c => c.status === 'expired').length,
      thisMonth: certificates.filter(c => 
        new Date(c.generatedAt).getMonth() === now.getMonth() &&
        new Date(c.generatedAt).getFullYear() === now.getFullYear()
      ).length,
      byStatus: {
        generated: certificates.filter(c => c.status === 'generated').length,
        sent: certificates.filter(c => c.status === 'sent').length,
        verified: certificates.filter(c => c.status === 'verified').length,
        expired: certificates.filter(c => c.status === 'expired').length
      },
      byCourse: this.groupCertificatesByCourse(certificates),
      expiringNextMonth: certificates.filter(c => 
        c.validUntil && 
        new Date(c.validUntil) > now &&
        new Date(c.validUntil) <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      )
    };
  }

  /**
   * 🗂️ Group certificates by course for analytics
   */
  private groupCertificatesByCourse(certificates: GeneratedCertificate[]) {
    const grouped: Record<string, { courseName: string; count: number; certificates: GeneratedCertificate[] }> = {};
    
    certificates.forEach(cert => {
      if (!grouped[cert.courseId]) {
        grouped[cert.courseId] = {
          courseName: cert.courseName,
          count: 0,
          certificates: []
        };
      }
      grouped[cert.courseId].count++;
      grouped[cert.courseId].certificates.push(cert);
    });
    
    return grouped;
  }

  // Utility Methods
  private generateCertificateId(): string {
    return `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVerificationCode(): string {
    return `HC${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }

  private generateCertificateUrl(userId: string, courseId: string): string {
    return `${window.location.origin}/certificates/view/${userId}/${courseId}`;
  }

  private calculateExpirationDate(validFor: string): string | undefined {
    if (validFor === 'No expiry') return undefined;
    
    const now = new Date();
    const match = validFor.match(/(\d+)\s*(year|month|day)s?/i);
    
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      switch (unit) {
        case 'year':
          now.setFullYear(now.getFullYear() + amount);
          break;
        case 'month':
          now.setMonth(now.getMonth() + amount);
          break;
        case 'day':
          now.setDate(now.getDate() + amount);
          break;
      }
    }
    
    return now.toISOString();
  }

  private extractPercentage(text: string): number {
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 70; // Default to 70%
  }

  private prepareCertificateDownload(certificate: GeneratedCertificate): Promise<boolean> {
    // Simulate download preparation
    console.log('📄 Preparing certificate download for:', certificate.id);
    return Promise.resolve(true);
  }

  private notifyAdminOfGeneration(certificate: GeneratedCertificate): void {
    const adminNotifications = JSON.parse(localStorage.getItem('admin_notifications') || '[]');
    adminNotifications.push({
      type: 'certificate_generated',
      timestamp: new Date().toISOString(),
      message: `Certificate generated for ${certificate.userName} - ${certificate.certificateName}`,
      certificateId: certificate.id
    });
    localStorage.setItem('admin_notifications', JSON.stringify(adminNotifications));
  }

  private logCertificateEvent(action: string, certificate: GeneratedCertificate): void {
    const events = JSON.parse(localStorage.getItem('certificate_events') || '[]');
    events.push({
      action,
      certificateId: certificate.id,
      userId: certificate.userId,
      courseId: certificate.courseId,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('certificate_events', JSON.stringify(events.slice(-100))); // Keep last 100 events
  }

  private loadStoredCertificates(): void {
    const stored = localStorage.getItem('generated_certificates');
    if (stored) {
      try {
        const certificateArray = JSON.parse(stored);
        certificateArray.forEach((cert: GeneratedCertificate) => {
          this.certificates.set(cert.id, cert);
        });
      } catch (error) {
        console.error('Failed to load stored certificates:', error);
      }
    }
  }

  private persistCertificates(): void {
    const certificateArray = Array.from(this.certificates.values());
    localStorage.setItem('generated_certificates', JSON.stringify(certificateArray));
  }

  private loadDefaultTemplates(): void {
    const defaultTemplates: CertificateTemplate[] = [
      {
        id: 'template-professional-a',
        name: 'Professional Template A',
        type: 'professional',
        design: {
          primaryColor: '#FF8895',
          secondaryColor: '#D72638',
          logo: 'huddle-co-logo.png',
          background: 'certificate-bg-professional.jpg',
          font: 'serif'
        },
        layout: {
          titlePosition: 'center',
          signaturePosition: 'bottom',
          logoPosition: 'top-center'
        },
        elements: {
          showBorder: true,
          showSeal: true,
          showWatermark: false,
          showQRCode: true
        }
      },
      {
        id: 'template-modern-b',
        name: 'Modern Template B',
        type: 'modern',
        design: {
          primaryColor: '#3A7DFF',
          secondaryColor: '#2D9B66',
          logo: 'huddle-co-logo.png',
          background: 'certificate-bg-modern.jpg',
          font: 'sans-serif'
        },
        layout: {
          titlePosition: 'top',
          signaturePosition: 'right',
          logoPosition: 'top-left'
        },
        elements: {
          showBorder: false,
          showSeal: false,
          showWatermark: true,
          showQRCode: true
        }
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  // Public API Methods
  getAllCertificates(): GeneratedCertificate[] {
    return Array.from(this.certificates.values());
  }

  getCertificatesByUser(userId: string): GeneratedCertificate[] {
    return Array.from(this.certificates.values()).filter(cert => cert.userId === userId);
  }

  getCertificatesByCourse(courseId: string): GeneratedCertificate[] {
    return Array.from(this.certificates.values()).filter(cert => cert.courseId === courseId);
  }

  updateDeliverySettings(settings: Partial<CertificateDelivery>): void {
    this.deliverySettings = { ...this.deliverySettings, ...settings };
    localStorage.setItem('certificate_delivery_settings', JSON.stringify(this.deliverySettings));
  }

  getDeliverySettings(): CertificateDelivery {
    return { ...this.deliverySettings };
  }
}

// Export singleton instance
export const certificateService = new CertificateService();