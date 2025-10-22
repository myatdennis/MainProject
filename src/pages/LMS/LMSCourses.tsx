import { useState } from 'react';
import { Link } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { 
  Play,
  Clock,
  CheckCircle,
  BookOpen,
  Star,
  Filter,
  Search
} from 'lucide-react';

const LMSCourses = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Get courses from store and filter only published ones for learners
  const modules = courseStore.getAllCourses().filter(course => course.status === 'published');

  const filteredModules = modules.filter(module => {
    const matchesSearch = module.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         module.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || module.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-100 text-green-800';
    if (progress > 0) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (progress: number) => {
    if (progress >= 100) return 'Completed';
    if (progress > 0) return 'In Progress';
    return 'Not Started';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-blue-100 text-blue-800';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with gradient */}
      <div className="mb-8 bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-8 border border-blue-100">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">My Learning Journey</h1>
        <p className="text-lg text-gray-700">Explore courses designed to enhance your skills and knowledge</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
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
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Courses</option>
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Courses</p>
              <p className="text-3xl font-bold text-gray-900">{filteredModules.length}</p>
            </div>
            <BookOpen className="h-12 w-12 text-blue-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">In Progress</p>
              <p className="text-3xl font-bold text-gray-900">
                {filteredModules.filter(m => m.progress > 0 && m.progress < 100).length}
              </p>
            </div>
            <Clock className="h-12 w-12 text-orange-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-3xl font-bold text-gray-900">
                {filteredModules.filter(m => m.progress >= 100).length}
              </p>
            </div>
            <CheckCircle className="h-12 w-12 text-green-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredModules.map((module) => (
          <div key={module.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="relative group">
              <img
                src={module.thumbnail}
                alt={module.title}
                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute top-4 left-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(module.progress)}`}>
                  {getStatusText(module.progress)}
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(module.difficulty)}`}>
                  {module.difficulty}
                </span>
              </div>
              {module.progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-xs font-medium">{module.progress}% Complete</span>
                  </div>
                  <div className="w-full bg-white/30 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-green-400 h-2 rounded-full shadow-lg"
                      style={{ width: `${module.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 line-clamp-2 flex-1">{module.title}</h3>
                <div className="flex items-center space-x-1 ml-2">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="text-sm font-semibold text-gray-700">{module.rating}</span>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{module.description}</p>
              
              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {module.duration}
                </span>
                <span className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-1" />
                  {module.lessons} lessons
                </span>
                <span>{module.type}</span>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Key Takeaways:</h4>
                <ul className="space-y-1">
                  {module.keyTakeaways.slice(0, 2).map((takeaway, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></div>
                      {takeaway}
                    </li>
                  ))}
                  {module.keyTakeaways.length > 2 && (
                    <li className="text-sm text-gray-500">
                      +{module.keyTakeaways.length - 2} more topics
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <Link
                  to={`/lms/module/${module.id}`}
                  onClick={() => {
                    try {
                      const c = courseStore.getCourse(module.id);
                      if (c && (c.progress || 0) === 0) {
                        courseStore.updateCourseStats(c.id, { enrollments: (c.enrollments || 0) + 1 });
                      }
                    } catch (e) {
                      console.warn('Failed to update enrollment', e);
                    }
                  }}
                  className="bg-gradient-to-r from-blue-500 to-green-500 text-white px-5 py-2.5 rounded-lg font-semibold hover:from-blue-600 hover:to-green-600 transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
                >
                  <Play className="h-4 w-4" />
                  <span>
                    {module.progress >= 100 ? 'Review Course' : module.progress > 0 ? 'Continue Learning' : 'Start Learning'}
                  </span>
                </Link>
                
                {module.progress >= 100 && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-1" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredModules.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Learning Path Overview */}
      <div className="mt-12 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Learning Journey</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            These courses are designed to build upon each other, creating a comprehensive foundation in inclusive leadership. 
            Complete them in order for the best learning experience.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">2/5</div>
              <div className="text-sm text-gray-600">Modules Started</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">1/5</div>
              <div className="text-sm text-gray-600">Modules Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">45%</div>
              <div className="text-sm text-gray-600">Overall Progress</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LMSCourses;