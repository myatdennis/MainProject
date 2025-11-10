import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Award, 
  Download, 
  Share2, 
  Calendar, 
  User, 
  Trophy,
  Search,
  Eye,
  ExternalLink
} from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import { useToast } from '../../context/ToastContext';
import { getCertificatesByUser, type GeneratedCertificate } from '../../dal/certificates';
import EmptyState from '../../components/ui/EmptyState';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useUserProfile } from '../../hooks/useUserProfile';

interface Certificate {
  id: string;
  courseTitle: string;
  courseName: string;
  completionDate: string;
  issueDate: string;
  certificateUrl: string;
  thumbnailUrl?: string;
  instructor: string;
  credentialId: string;
  skills: string[];
  category: string;
  hours: number;
  grade?: string;
  status: 'active' | 'expired' | 'revoked';
  validUntil?: string;
  shareableUrl: string;
}

const LMSCertificates: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'course' | 'grade'>('date');
  const { user } = useUserProfile();
  const learnerId = useMemo(() => {
    if (user) return (user.email || user.id || 'local-user').toLowerCase();
    try {
      const raw = localStorage.getItem('huddle_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return (parsed.email || parsed.id || 'local-user').toLowerCase();
      }
    } catch (error) {
      console.warn('Failed to parse learner identity for certificates (legacy fallback):', error);
    }
    return 'local-user';
  }, [user]);
  
  useEffect(() => {
    loadCertificates();
  }, [learnerId]);

  const loadCertificates = async () => {
    setLoading(true);
    try {
  const generatedCertificates = await getCertificatesByUser(learnerId);
      const normalized = generatedCertificates.map((cert: GeneratedCertificate) => {
        const completionTimeToken = cert.metadata?.completionTime ?? '';
        const completionMinutes = parseInt(String(completionTimeToken).replace(/[^0-9]/g, ''), 10);
        const effectiveMinutes = Number.isFinite(completionMinutes) ? completionMinutes : 60;
        const inferredHours = Math.max(1, Math.round(effectiveMinutes / 60));
        const requirements = cert.metadata.requirements || [];

        return {
          id: cert.id,
          courseTitle: cert.courseName,
          courseName: cert.courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          completionDate: cert.completionDate,
          issueDate: cert.generatedAt,
          certificateUrl: cert.certificateUrl,
          instructor: cert.metadata.instructorName,
          credentialId: cert.verificationCode,
          skills: requirements.length > 0 ? requirements : ['Certificate earned'],
          category: cert.metadata.organizationName || 'Learning',
          hours: inferredHours,
          grade: cert.metadata.finalScore !== undefined ? `${cert.metadata.finalScore}%` : undefined,
          status: cert.status === 'expired' ? 'expired' : 'active',
          validUntil: cert.validUntil,
          shareableUrl: `${window.location.origin}/verify/${cert.verificationCode}`
        } as Certificate;
      });

      setCertificates(normalized);
    } catch (error) {
      showToast('Failed to load certificates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCertificates = certificates
    .filter(cert => {
      const matchesSearch = cert.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cert.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === 'all' || cert.category.toLowerCase() === filterCategory;
      const matchesStatus = filterStatus === 'all' || cert.status === filterStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime();
        case 'course':
          return a.courseTitle.localeCompare(b.courseTitle);
        case 'grade':
          return (b.grade || 'Z').localeCompare(a.grade || 'Z');
        default:
          return 0;
      }
    });

  const categories = ['all', ...new Set(certificates.map(cert => cert.category.toLowerCase()))];

  const downloadCertificate = async (certificate: Certificate) => {
    try {
      if (!certificate.certificateUrl) {
        showToast('Certificate link unavailable', 'error');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = certificate.certificateUrl;
      anchor.download = `${certificate.courseTitle.replace(/\s+/g, '-')}-certificate.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      showToast('Certificate download started', 'success');
    } catch (error) {
      showToast('Failed to download certificate', 'error');
    }
  };

  const shareCertificate = async (certificate: Certificate) => {
    try {
      await navigator.clipboard.writeText(certificate.shareableUrl);
      showToast('Certificate link copied to clipboard!', 'success');
    } catch (error) {
      showToast('Failed to copy link', 'error');
    }
  };

  const viewCertificate = (certificate: Certificate) => {
    // Open certificate in new tab for viewing
    window.open(certificate.certificateUrl, '_blank');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getGradeColor = (grade?: string) => {
    if (!grade) return 'text-gray-500';
    const letter = grade.charAt(0);
    switch (letter) {
      case 'A': return 'text-green-600';
      case 'B': return 'text-blue-600';
      case 'C': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'expired': return 'text-yellow-600 bg-yellow-100';
      case 'revoked': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <>
      <SEO 
        title="My Certificates - Learning Platform"
        description="View and manage your earned certificates and achievements"
        keywords={['certificates', 'achievements', 'credentials', 'learning', 'completion']}
      />
      
      <div className="min-h-screen bg-softwhite">
        <div className="container-page section">
          <Breadcrumbs items={[{ label: 'Certificates', to: '/lms/certificates' }]} />
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="h-7 w-7 text-orange-500" />
              <h1 className="h1">My Certificates</h1>
            </div>
            <button onClick={() => navigate('/lms/dashboard')} className="nav-link">Back to Dashboard</button>
          </div>

          <div className="">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card-lg card-hover">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate/80">Total Certificates</p>
                  <p className="text-2xl font-bold text-charcoal">{certificates.length}</p>
                </div>
              </div>
            </div>
            
            <div className="card-lg card-hover">
              <div className="flex items-center">
                <Trophy className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate/80">Active</p>
                  <p className="text-2xl font-bold text-charcoal">
                    {certificates.filter(c => c.status === 'active').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card-lg card-hover">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate/80">Hours Completed</p>
                  <p className="text-2xl font-bold text-charcoal">
                    {certificates.reduce((total, cert) => total + cert.hours, 0)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card-lg card-hover">
              <div className="flex items-center">
                <User className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate/80">Skills Earned</p>
                  <p className="text-2xl font-bold text-charcoal">
                    {new Set(certificates.flatMap(c => c.skills)).size}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="card-lg card-hover mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search certificates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="date">Sort by Date</option>
                <option value="course">Sort by Course</option>
                <option value="grade">Sort by Grade</option>
              </select>
            </div>
          </div>

          {/* Certificates Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading certificates...</p>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <EmptyState
              title={searchTerm ? 'No matching certificates' : 'No certificates yet'}
              description={searchTerm ? 'Try adjusting your search filters' : 'Complete courses to earn your first certificate!'}
              action={!searchTerm ? (
                <button onClick={() => navigate('/lms/courses')} className="btn-cta">Browse Courses</button>
              ) : undefined}
              illustrationSrc={undefined}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCertificates.map(certificate => (
                <div
                  key={certificate.id}
                  className="card-lg card-hover overflow-hidden transition-shadow"
                >
                  {/* Certificate Header */}
                  <div className="px-6 py-4" style={{ backgroundImage: 'var(--gradient-orange-red)' }}>
                    <div className="flex items-center justify-between">
                      <Award className="h-8 w-8 text-white" />
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(certificate.status)}`}>
                        {certificate.status.charAt(0).toUpperCase() + certificate.status.slice(1)}
                      </span>
                    </div>
                    <h3 className="text-white font-bold text-lg mt-2 line-clamp-2">
                      {certificate.courseTitle}
                    </h3>
                    <p className="text-orange-100 text-sm">
                      Credential ID: {certificate.credentialId}
                    </p>
                  </div>

                  {/* Certificate Body */}
                  <div className="p-6">
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        Completed: {formatDate(certificate.completionDate)}
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="h-4 w-4 mr-2" />
                        Instructor: {certificate.instructor}
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{certificate.hours} hours</span>
                        {certificate.grade && (
                          <span className={`font-medium ${getGradeColor(certificate.grade)}`}>
                            Grade: {certificate.grade}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-2">Skills Demonstrated:</p>
                      <div className="flex flex-wrap gap-1">
                        {certificate.skills.slice(0, 3).map(skill => (
                          <span
                            key={skill}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                        {certificate.skills.length > 3 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                            +{certificate.skills.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => viewCertificate(certificate)}
                        className="flex-1 btn-outline"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </button>
                      
                      <button
                        onClick={() => downloadCertificate(certificate)}
                        className="flex-1 btn-cta"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </button>
                      
                      <button
                        onClick={() => shareCertificate(certificate)}
                        className="btn-outline px-3 py-2"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Verification Link */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <a
                        href={certificate.shareableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-xs text-gray-500 hover:text-orange-600"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Verify Certificate
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
};

export default LMSCertificates;
