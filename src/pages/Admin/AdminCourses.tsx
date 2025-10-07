import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter,
  Edit,
  Copy,
  Trash2,
  Eye,
  Users,
  Clock,
  Play,
  FileText,
  Video,
  BarChart3,
  Settings,
  Upload,
  Download
} from 'lucide-react';


const AdminCourses = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const navigate = useNavigate();

  // Get courses from store
  const courses = courseStore.getAllCourses();

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === 'all' || course.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCourses.length === filteredCourses.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(filteredCourses.map(course => course.id));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'interactive':
        return <Play className="h-4 w-4" />;
      case 'worksheet':
        return <FileText className="h-4 w-4" />;
      case 'case-study':
        return <BookOpen className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'text-blue-600 bg-blue-50';
      case 'interactive':
        return 'text-green-600 bg-green-50';
      case 'worksheet':
        return 'text-orange-600 bg-orange-50';
      case 'case-study':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const duplicateCourse = (courseId: string) => {
    const original = courseStore.getCourse(courseId);
    if (!original) return;

    // Create a shallow clone with a new id and title
    const newId = `course-${Date.now()}`;
    const cloned = {
      ...original,
      id: newId,
      title: `${original.title} (Copy)`,
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      enrollments: 0,
      completions: 0,
      completionRate: 0,
    };

    // Save to store and navigate to builder
    try {
      courseStore.saveCourse(cloned);
      navigate(`/admin/course-builder/${newId}`);
    } catch (err) {
      console.warn('Failed to duplicate course', err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Management</h1>
        <p className="text-gray-600">Create, edit, and manage training modules and learning paths</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search courses..."
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
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          
            <div className="flex items-center space-x-4">
            {selectedCourses.length > 0 && (
              <div className="flex items-center space-x-2">
                <button onClick={() => navigate(`/admin/courses/bulk?ids=${selectedCourses.join(',')}`)} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200">
                  Bulk Assign ({selectedCourses.length})
                </button>
                <button onClick={() => { /* publish selected in-place */ alert('Publish selected: ' + selectedCourses.join(',')); }} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors duration-200">
                  Publish Selected
                </button>
              </div>
            )}
            <button onClick={() => navigate('/admin/course-builder/new')} className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Create Course</span>
            </button>
            <button onClick={() => navigate('/admin/courses/import')} className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {filteredCourses.map((course) => (
          <div key={course.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="relative">
              <img 
                src={course.thumbnail} 
                alt={course.title}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-4 left-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(course.status)}`}>
                  {course.status}
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <input
                  type="checkbox"
                  checked={selectedCourses.includes(course.id)}
                  onChange={() => handleSelectCourse(course.id)}
                  className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                />
              </div>
              <div className="absolute bottom-4 left-4">
                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(course.type)}`}>
                  {getTypeIcon(course.type)}
                  <span className="capitalize">{course.type}</span>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-2">{course.title}</h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {course.duration}
                </span>
                <span className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-1" />
                  {course.lessons} lessons
                </span>
                <span className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {course.enrollments}
                </span>
              </div>

              {course.status === 'published' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className="font-medium text-gray-900">{course.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full"
                      style={{ width: `${course.completionRate}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1 mb-4">
                {course.tags.map((tag, index) => (
                  <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Updated {new Date(course.lastUpdated).toLocaleDateString()}
                </div>
                <div className="flex items-center space-x-2">
                  <Link 
                    to={`/admin/courses/${course.id}/details`}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg" 
                    title="Preview as Participant"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link 
                    to={`/admin/course-builder/${course.id}`}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" 
                    title="Edit Course"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button onClick={() => duplicateCourse(course.id)} className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </button>
                  
                  
                  <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" title="Analytics">
                    <BarChart3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Course Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Course Details</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSelectAll}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              {selectedCourses.length === filteredCourses.length ? 'Deselect All' : 'Select All'}
            </button>
            <button className="flex items-center space-x-2 text-orange-500 hover:text-orange-600 font-medium">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6">
                  <input
                    type="checkbox"
                    checked={selectedCourses.length === filteredCourses.length && filteredCourses.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                </th>
                <th className="text-left py-3 px-6 font-semibold text-gray-900">Course</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Type</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Enrollments</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Completion</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Rating</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Status</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => (
                <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course.id)}
                      onChange={() => handleSelectCourse(course.id)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{course.title}</div>
                        <div className="text-sm text-gray-600">{course.lessons} lessons • {course.duration}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(course.type)}`}>
                      {getTypeIcon(course.type)}
                      <span className="capitalize">{course.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="font-medium text-gray-900">{course.enrollments}</div>
                    <div className="text-sm text-gray-600">{course.completions} completed</div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="font-medium text-gray-900">{course.completionRate}%</div>
                    <div className="w-16 bg-gray-200 rounded-full h-1 mt-1 mx-auto">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-500 h-1 rounded-full"
                        style={{ width: `${course.completionRate}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {course.avgRating > 0 ? (
                      <div className="flex items-center justify-center space-x-1">
                        <span className="font-medium text-gray-900">{course.avgRating}</span>
                        <div className="text-yellow-400">★</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(course.status)}`}>
                      {course.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Link 
                        to={`/admin/courses/${course.id}/details?viewMode=learner`}
                        className="p-1 text-blue-600 hover:text-blue-800" 
                        title="Preview as Participant"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/admin/course-builder/${course.id}`}
                        className="p-1 text-gray-600 hover:text-gray-800"
                        title="Edit Course"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button onClick={() => duplicateCourse(course.id)} className="p-1 text-gray-600 hover:text-gray-800" title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-600 hover:text-gray-800" title="Settings">
                        <Settings className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-red-600 hover:text-red-800" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-blue-600">{courses.length}</div>
          <div className="text-sm text-gray-600">Total Courses</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-green-600">
            {courses.filter(c => c.status === 'published').length}
          </div>
          <div className="text-sm text-gray-600">Published</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {courses.reduce((acc, course) => acc + course.enrollments, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Enrollments</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round(courses.filter(c => c.avgRating > 0).reduce((acc, course) => acc + course.avgRating, 0) / courses.filter(c => c.avgRating > 0).length * 10) / 10 || 0}
          </div>
          <div className="text-sm text-gray-600">Avg. Rating</div>
        </div>
      </div>
    </div>
  );
};

export default AdminCourses;