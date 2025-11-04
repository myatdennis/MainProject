import { useState } from 'react';
import { Download, FileText, Video, Archive, Search, Filter, Calendar, Folder } from 'lucide-react';
import EmptyState from '../../components/ui/EmptyState';
import Breadcrumbs from '../../components/ui/Breadcrumbs';

const LMSDownloads = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const resources = [
    {
      id: '1',
      title: 'Leadership Self-Assessment',
      type: 'PDF',
      category: 'Foundations of Inclusive Leadership',
      size: '2.3 MB',
      uploadDate: '2025-01-15',
      description: 'Comprehensive self-assessment tool to evaluate your current leadership style and identify areas for growth.',
      downloadUrl: '#',
      icon: FileText,
      color: 'text-red-500'
    },
    {
      id: '2',
      title: 'Psychological Safety Checklist',
      type: 'PDF',
      category: 'Foundations of Inclusive Leadership',
      size: '1.8 MB',
      uploadDate: '2025-01-15',
      description: 'Practical checklist to assess and improve psychological safety within your team.',
      downloadUrl: '#',
      icon: FileText,
      color: 'text-red-500'
    },
    {
      id: '3',
      title: 'Team Reflection Worksheet',
      type: 'PDF',
      category: 'Foundations of Inclusive Leadership',
      size: '1.2 MB',
      uploadDate: '2025-01-15',
      description: 'Guided worksheet for team reflection sessions and goal setting.',
      downloadUrl: '#',
      icon: FileText,
      color: 'text-red-500'
    },
    {
      id: '4',
      title: 'Bias Recognition Toolkit',
      type: 'PDF',
      category: 'Recognizing and Mitigating Bias',
      size: '3.1 MB',
      uploadDate: '2025-01-10',
      description: 'Complete toolkit with exercises and frameworks for identifying and addressing unconscious bias.',
      downloadUrl: '#',
      icon: FileText,
      color: 'text-red-500'
    },
    {
      id: '5',
      title: 'Structured Interview Guide',
      type: 'PDF',
      category: 'Recognizing and Mitigating Bias',
      size: '2.7 MB',
      uploadDate: '2025-01-10',
      description: 'Step-by-step guide for conducting bias-free interviews and evaluations.',
      downloadUrl: '#',
      icon: FileText,
      color: 'text-red-500'
    },
    {
      id: '6',
      title: 'Introduction to Inclusive Leadership',
      type: 'MP4',
      category: 'Foundations of Inclusive Leadership',
      size: '45.2 MB',
      uploadDate: '2025-01-15',
      description: 'Foundational video covering the principles and practices of inclusive leadership.',
      downloadUrl: '#',
      icon: Video,
      color: 'text-blue-500'
    },
    {
      id: '7',
      title: 'Understanding Psychological Safety',
      type: 'MP4',
      category: 'Foundations of Inclusive Leadership',
      size: '67.8 MB',
      uploadDate: '2025-01-15',
      description: 'Deep dive into creating and maintaining psychological safety in teams.',
      downloadUrl: '#',
      icon: Video,
      color: 'text-blue-500'
    },
    {
      id: '8',
      title: 'Conversation Planning Template',
      type: 'DOCX',
      category: 'Courageous Conversations at Work',
      size: '0.8 MB',
      uploadDate: '2025-01-05',
      description: 'Editable template for planning and structuring difficult conversations.',
      downloadUrl: '#',
      icon: FileText,
      color: 'text-green-500'
    },
    {
      id: '9',
      title: 'Action Planning Workbook',
      type: 'PDF',
      category: 'Personal & Team Action Planning',
      size: '4.2 MB',
      uploadDate: '2025-01-01',
      description: 'Comprehensive workbook for creating personal and team development action plans.',
      downloadUrl: '#',
      icon: FileText,
      color: 'text-red-500'
    },
    {
      id: '10',
      title: 'Complete Resource Package',
      type: 'ZIP',
      category: 'All Modules',
      size: '128.5 MB',
      uploadDate: '2025-01-15',
      description: 'All course materials, videos, and worksheets in one convenient package.',
      downloadUrl: '#',
      icon: Archive,
      color: 'text-purple-500'
    }
  ];

  const categories = [
    'All Modules',
    'Foundations of Inclusive Leadership',
    'Recognizing and Mitigating Bias',
    'Empathy in Action',
    'Courageous Conversations at Work',
    'Personal & Team Action Planning'
  ];

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || resource.type.toLowerCase() === filterType.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredResources.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredResources.map(resource => resource.id));
    }
  };

  const handleDownloadSelected = () => {
    // In a real app, this would trigger downloads for selected items
    console.log('Downloading selected items:', selectedItems);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFileTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'bg-red-100 text-red-800';
      case 'mp4':
        return 'bg-blue-100 text-blue-800';
      case 'docx':
        return 'bg-green-100 text-green-800';
      case 'zip':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-softwhite">
      <div className="container-page section">
        <Breadcrumbs items={[{ label: 'Downloads', to: '/lms/downloads' }]} />
        {/* Header */}
        <div className="mb-8">
          <h1 className="h1">Downloads</h1>
          <p className="lead">Access all your course materials, worksheets, and resources</p>
        </div>

      {/* Search and Filter Bar */}
      <div className="card-lg card-hover mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-mist px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="pdf">PDF</option>
                <option value="mp4">Video</option>
                <option value="docx">Document</option>
                <option value="zip">Archive</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedItems.length > 0 && (
              <button
                onClick={handleDownloadSelected}
                className="btn-cta px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download Selected ({selectedItems.length})</span>
              </button>
            )}
            <button
              onClick={handleSelectAll}
              className="nav-link font-medium"
            >
              {selectedItems.length === filteredResources.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="mb-8">
        <h2 className="h2 mb-4">Browse by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const categoryCount = resources.filter(r => r.category === category).length;
            return (
              <div key={category} className="card-lg card-hover cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-50 p-2 rounded-lg">
                    <Folder className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-charcoal">{category}</h3>
                    <p className="text-sm text-slate/80">{categoryCount} resources</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredResources.map((resource) => {
          const Icon = resource.icon;
          const isSelected = selectedItems.includes(resource.id);
          
          return (
            <div 
              key={resource.id} 
              className={`card-lg card-hover transition-all duration-200 ${
                isSelected ? 'ring-2 ring-orange-500' : ''
              }`}
            >
              <div className="">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectItem(resource.id)}
                        className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-mist rounded"
                      />
                    </div>
                    <div className={`p-3 rounded-lg bg-white/50`}>
                      <Icon className={`h-6 w-6 ${resource.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-lg font-semibold text-charcoal mb-1">{resource.title}</h3>
                      <p className="text-sm text-slate/80 mb-2">{resource.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-slate/70">
                        <span className={`px-2 py-1 rounded-full font-medium ${getFileTypeColor(resource.type)}`}>
                          {resource.type}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(resource.uploadDate)}
                        </span>
                        <span>{resource.size}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate/80">
                    <span className="font-medium">Category:</span> {resource.category}
                  </div>
                  <a
                    href={resource.downloadUrl}
                    className="btn-outline px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredResources.length === 0 && (
        <div className="mt-8">
          <EmptyState
            title="No resources found"
            description="Try adjusting your search or filter criteria."
            action={(
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setFilterType('all'); setSelectedItems([]); }}
                className="btn-outline"
              >
                Reset filters
              </button>
            )}
            illustrationSrc={undefined}
          />
        </div>
      )}

      {/* Quick Download Section */}
      <div className="mt-12 rounded-xl p-8" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--hud-blue) 10%, transparent), color-mix(in srgb, var(--hud-green) 10%, transparent))' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Everything at Once?</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Download our complete resource package containing all course materials, videos, and worksheets in one convenient ZIP file.
          </p>
          <a href="/lms/downloads/package" className="btn-cta px-8 py-4 rounded-full font-semibold text-lg transition-all duration-200 transform hover:scale-105 flex items-center mx-auto space-x-2">
            <Archive className="h-5 w-5" />
            <span>Download Complete Package (128.5 MB)</span>
          </a>
        </div>
      </div>
      </div>
    </div>
  );
};

export default LMSDownloads;