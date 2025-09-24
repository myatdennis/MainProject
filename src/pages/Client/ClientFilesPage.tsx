import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Search,
  Filter,
  FolderOpen,
  Eye,
  ChevronRight
} from 'lucide-react';
import clientPortalService from '../../services/clientPortalService';
import type { AssignedFile } from '../../types/clientPortal';

const ClientFilesPage = () => {
  const [files, setFiles] = useState<AssignedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const dashboardData = await clientPortalService.getClientDashboardData();
        setFiles(dashboardData.files);
      } catch (error) {
        console.error('Error loading files:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, []);

  const handleDownload = (file: AssignedFile) => {
    // Update download status
    setFiles(prev => prev.map(f => 
      f.id === file.id 
        ? { ...f, downloaded: true, downloadedAt: new Date().toISOString() }
        : f
    ));

    // In a real app, this would track downloads in the backend
    console.log(`Downloaded file: ${file.name}`);
  };

  const categories = Array.from(new Set(files.map(f => f.category)));
  const types = Array.from(new Set(files.map(f => f.type)));

  const filteredFiles = files.filter(file => {
    if (searchTerm && !file.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !file.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (categoryFilter !== 'all' && file.category !== categoryFilter) {
      return false;
    }
    if (typeFilter !== 'all' && file.type !== typeFilter) {
      return false;
    }
    return true;
  });

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'xls':
      case 'xlsx': return '📊';
      case 'ppt':
      case 'pptx': return '📋';
      case 'video':
      case 'mp4': return '🎥';
      case 'audio':
      case 'mp3': return '🎵';
      default: return '📁';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <FileText className="h-8 w-8 mr-3 text-orange-500" />
                Files & Resources
              </h1>
              <p className="text-gray-600 mt-1">Access and download shared documents and resources</p>
            </div>
            <Link 
              to="/client/dashboard" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-2xl font-bold text-gray-900">{files.length}</div>
            <div className="text-sm text-gray-600">Total Files</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-2xl font-bold text-green-600">
              {files.filter(f => f.downloaded).length}
            </div>
            <div className="text-sm text-gray-600">Downloaded</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-2xl font-bold text-orange-600">
              {files.filter(f => !f.downloaded).length}
            </div>
            <div className="text-sm text-gray-600">Not Downloaded</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-2xl font-bold text-blue-600">{categories.length}</div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="relative flex-1 max-w-md">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Files Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredFiles.map((file) => (
            <div 
              key={file.id} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                      {getFileIcon(file.type)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {file.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {file.downloaded && (
                          <CheckCircle className="h-5 w-5 text-green-500" title="Downloaded" />
                        )}
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                          {file.type}
                        </span>
                      </div>
                    </div>
                    
                    {file.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {file.description}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center">
                        <FolderOpen className="h-4 w-4 mr-1" />
                        {file.category}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Shared {new Date(file.assignedAt).toLocaleDateString()}
                      </div>
                    </div>

                    {file.downloaded && file.downloadedAt && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center text-sm text-green-800">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Downloaded on {new Date(file.downloadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {file.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Preview</span>
                    </button>
                    <a
                      href={file.url}
                      onClick={() => handleDownload(file)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredFiles.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-600">
              {searchTerm || categoryFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No files have been shared with you yet.'}
            </p>
          </div>
        )}

        {/* Quick Access Categories */}
        {files.length > 0 && (
          <div className="mt-12 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Access by Category
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map(category => {
                const categoryFiles = files.filter(f => f.category === category);
                return (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">{category}</h3>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {categoryFiles.length} file{categoryFiles.length !== 1 ? 's' : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientFilesPage;