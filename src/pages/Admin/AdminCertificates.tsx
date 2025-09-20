import React, { useState } from 'react';
import { 
  Award, 
  Plus, 
  Search, 
  Filter,
  Download,
  Upload,
  Edit,
  Copy,
  Trash2,
  Eye,
  Calendar,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Settings,
  Palette,
  FileText
} from 'lucide-react';

const AdminCertificates = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);

  const certificates = [
    {
      id: '1',
      name: 'Inclusive Leadership Certification',
      description: 'Comprehensive certification for completing all 5 core modules',
      template: 'Professional Template A',
      issued: 142,
      expiry: '1 year',
      status: 'active',
      lastUpdated: '2025-02-15',
      requirements: ['Complete all 5 modules', 'Pass final assessment (80%)', 'Submit action plan'],
      design: {
        primaryColor: '#FF8895',
        secondaryColor: '#D72638',
        logo: 'huddle-co-logo.png',
        background: 'certificate-bg-1.jpg'
      }
    },
    {
      id: '2',
      name: 'Courageous Conversations Certificate',
      description: 'Specialized certificate for mastering difficult conversations',
      template: 'Modern Template B',
      issued: 89,
      expiry: '6 months',
      status: 'active',
      lastUpdated: '2025-02-10',
      requirements: ['Complete Conversations module', 'Practice session recording', 'Peer feedback'],
      design: {
        primaryColor: '#3A7DFF',
        secondaryColor: '#2D9B66',
        logo: 'huddle-co-logo.png',
        background: 'certificate-bg-2.jpg'
      }
    },
    {
      id: '3',
      name: 'DEI Foundations Certificate',
      description: 'Entry-level certificate for basic DEI understanding',
      template: 'Classic Template C',
      issued: 234,
      expiry: 'No expiry',
      status: 'active',
      lastUpdated: '2025-01-20',
      requirements: ['Complete Foundations module', 'Pass quiz (70%)', 'Reflection submission'],
      design: {
        primaryColor: '#2D9B66',
        secondaryColor: '#FF8895',
        logo: 'huddle-co-logo.png',
        background: 'certificate-bg-3.jpg'
      }
    },
    {
      id: '4',
      name: 'Advanced Leadership Certificate',
      description: 'Premium certification for senior leaders',
      template: 'Executive Template D',
      issued: 45,
      expiry: '2 years',
      status: 'draft',
      lastUpdated: '2025-03-01',
      requirements: ['Complete all modules', 'Leadership project', 'Mentor 2 colleagues', 'Executive assessment'],
      design: {
        primaryColor: '#D72638',
        secondaryColor: '#3A7DFF',
        logo: 'huddle-co-logo.png',
        background: 'certificate-bg-4.jpg'
      }
    }
  ];

  const expiringCertificates = [
    { learner: 'Sarah Chen', certificate: 'Inclusive Leadership', expires: '2025-03-20', daysLeft: 9 },
    { learner: 'Marcus Rodriguez', certificate: 'Courageous Conversations', expires: '2025-03-25', daysLeft: 14 },
    { learner: 'Jennifer Walsh', certificate: 'DEI Foundations', expires: '2025-04-01', daysLeft: 21 },
    { learner: 'David Thompson', certificate: 'Inclusive Leadership', expires: '2025-04-05', daysLeft: 25 }
  ];

  const templates = [
    { id: 'template-1', name: 'Professional Template A', preview: 'template-1-preview.jpg' },
    { id: 'template-2', name: 'Modern Template B', preview: 'template-2-preview.jpg' },
    { id: 'template-3', name: 'Classic Template C', preview: 'template-3-preview.jpg' },
    { id: 'template-4', name: 'Executive Template D', preview: 'template-4-preview.jpg' }
  ];

  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = cert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cert.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || cert.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleSelectCert = (certId: string) => {
    setSelectedCerts(prev => 
      prev.includes(certId) 
        ? prev.filter(id => id !== certId)
        : [...prev, certId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCerts.length === filteredCertificates.length) {
      setSelectedCerts([]);
    } else {
      setSelectedCerts(filteredCertificates.map(cert => cert.id));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getExpiryColor = (daysLeft: number) => {
    if (daysLeft <= 7) return 'text-red-600';
    if (daysLeft <= 14) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Certificate Management</h1>
        <p className="text-gray-600">Create, manage, and track digital certificates and credentials</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search certificates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedCerts.length > 0 && (
              <div className="flex items-center space-x-2">
                <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200">
                  Bulk Actions ({selectedCerts.length})
                </button>
              </div>
            )}
            <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Create Certificate</span>
            </button>
            <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Import Template</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Certificates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {filteredCertificates.map((cert) => (
              <div key={cert.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="relative">
                  <div className="h-32 bg-gradient-to-br from-orange-100 to-blue-100 flex items-center justify-center">
                    <Award className="h-12 w-12 text-orange-500" />
                  </div>
                  <div className="absolute top-4 left-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cert.status)}`}>
                      {cert.status}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <input
                      type="checkbox"
                      checked={selectedCerts.includes(cert.id)}
                      onChange={() => handleSelectCert(cert.id)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{cert.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{cert.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Issued:</span>
                      <span className="font-medium text-gray-900">{cert.issued}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Expiry:</span>
                      <span className="font-medium text-gray-900">{cert.expiry}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Template:</span>
                      <span className="font-medium text-gray-900">{cert.template}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Requirements:</h4>
                    <ul className="space-y-1">
                      {cert.requirements.slice(0, 2).map((req, index) => (
                        <li key={index} className="flex items-center text-xs text-gray-600">
                          <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                          {req}
                        </li>
                      ))}
                      {cert.requirements.length > 2 && (
                        <li className="text-xs text-gray-500">
                          +{cert.requirements.length - 2} more requirements
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Updated {new Date(cert.lastUpdated).toLocaleDateString()}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg" title="Preview">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" title="Settings">
                        <Settings className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Certificate Templates */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Certificate Templates</h2>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2">
                <Palette className="h-4 w-4" />
                <span>Design New Template</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
                  <div className="h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">{template.name}</h3>
                  <div className="flex items-center justify-between">
                    <button className="text-sm text-blue-600 hover:text-blue-700">Preview</button>
                    <button className="text-sm text-gray-600 hover:text-gray-700">Use Template</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Expiring Certificates */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <h3 className="text-lg font-bold text-gray-900">Expiring Soon</h3>
            </div>
            <div className="space-y-3">
              {expiringCertificates.map((cert, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{cert.learner}</div>
                    <div className="text-xs text-gray-600">{cert.certificate}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getExpiryColor(cert.daysLeft)}`}>
                      {cert.daysLeft} days
                    </div>
                    <div className="text-xs text-gray-500">{new Date(cert.expires).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-colors duration-200 text-sm">
              Send Renewal Reminders
            </button>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Certificate Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Issued</span>
                <span className="font-bold text-gray-900">510</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Active</span>
                <span className="font-bold text-green-600">467</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Expiring (30 days)</span>
                <span className="font-bold text-yellow-600">43</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Expired</span>
                <span className="font-bold text-red-600">12</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export All Certificates</span>
              </button>
              <button className="w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Schedule Renewals</span>
              </button>
              <button className="w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Bulk Issue Certificates</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCertificates;