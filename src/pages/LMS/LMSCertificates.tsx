import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Award, 
  Download, 
  Share2, 
  Calendar, 
  User, 
  Trophy,
  ArrowLeft,
  Search,
  Eye,
  ExternalLink
} from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import { useToast } from '../../context/ToastContext';

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

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      // Mock certificates data - replace with actual API call
      const mockCertificates: Certificate[] = [
        {
          id: 'cert_001',
          courseTitle: 'Inclusive Leadership Fundamentals',
          courseName: 'inclusive-leadership-fundamentals',
          completionDate: '2024-01-15',
          issueDate: '2024-01-16',
          certificateUrl: '/certificates/cert_001.pdf',
          instructor: 'Dr. Sarah Johnson',
          credentialId: 'ILF-2024-001',
          skills: ['Inclusive Leadership', 'Team Management', 'Bias Recognition'],
          category: 'Leadership',
          hours: 12,
          grade: 'A',
          status: 'active',
          shareableUrl: 'https://platform.inclusiveexcellence.com/verify/cert_001'
        },
        {
          id: 'cert_002',
          courseTitle: 'Courageous Conversations',
          courseName: 'courageous-conversations',
          completionDate: '2024-01-20',
          issueDate: '2024-01-21',
          certificateUrl: '/certificates/cert_002.pdf',
          instructor: 'Maria Rodriguez',
          credentialId: 'CC-2024-002',
          skills: ['Difficult Conversations', 'Conflict Resolution', 'Active Listening'],
          category: 'Communication',
          hours: 8,
          grade: 'A-',
          status: 'active',
          shareableUrl: 'https://platform.inclusiveexcellence.com/verify/cert_002'
        },
        {
          id: 'cert_003',
          courseTitle: 'DEI Strategy Implementation',
          courseName: 'dei-strategy',
          completionDate: '2023-11-10',
          issueDate: '2023-11-11',
          certificateUrl: '/certificates/cert_003.pdf',
          instructor: 'Dr. Michael Chen',
          credentialId: 'DEI-2023-003',
          skills: ['Strategy Development', 'Change Management', 'Metrics & Analytics'],
          category: 'Strategy',
          hours: 16,
          grade: 'B+',
          status: 'active',
          validUntil: '2026-11-11',
          shareableUrl: 'https://platform.inclusiveexcellence.com/verify/cert_003'
        }
      ];

      setCertificates(mockCertificates);
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
      // Mock download - replace with actual implementation
      showToast(`Downloading certificate for ${certificate.courseTitle}...`, 'info');
      // Simulate download
      setTimeout(() => {
        showToast('Certificate downloaded successfully!', 'success');
      }, 1000);
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
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/lms/dashboard')}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </button>
                <div className="flex items-center space-x-3">
                  <Award className="h-6 w-6 text-orange-500" />
                  <h1 className="text-xl font-bold text-gray-900">My Certificates</h1>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {certificates.length} certificate{certificates.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Certificates</p>
                  <p className="text-2xl font-bold text-gray-900">{certificates.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Trophy className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {certificates.filter(c => c.status === 'active').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Hours Completed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {certificates.reduce((total, cert) => total + cert.hours, 0)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <User className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Skills Earned</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Set(certificates.flatMap(c => c.skills)).size}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search certificates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
              <Award className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No matching certificates' : 'No certificates yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? 'Try adjusting your search filters'
                  : 'Complete courses to earn your first certificate!'
                }
              </p>
              {!searchTerm && (
                <button
                  onClick={() => navigate('/lms/courses')}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                >
                  Browse Courses
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCertificates.map(certificate => (
                <div
                  key={certificate.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Certificate Header */}
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
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
                        className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </button>
                      
                      <button
                        onClick={() => downloadCertificate(certificate)}
                        className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </button>
                      
                      <button
                        onClick={() => shareCertificate(certificate)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
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
    </>
  );
};

export default LMSCertificates;