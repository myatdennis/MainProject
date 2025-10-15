import React, { useState, useEffect } from 'react';
import { History, RotateCcw, GitBranch, Clock, User, CheckCircle, AlertCircle } from 'lucide-react';
import { Course } from '../types/courseTypes';

interface CourseVersion {
  id: string;
  timestamp: number;
  course: Course;
  changeDescription: string;
  changedBy: string;
  changeType: 'create' | 'update' | 'structure' | 'content' | 'settings';
}

interface VersionControlProps {
  course: Course;
  onRestore: (version: CourseVersion) => void;
}

const VersionControl: React.FC<VersionControlProps> = ({ course, onRestore }) => {
  const [versions, setVersions] = useState<CourseVersion[]>([]);
  const [showDiff, setShowDiff] = useState<string | null>(null);

  // Auto-save version when course changes significantly
  useEffect(() => {
    if (course.id && course.title) {
      const existingVersions = JSON.parse(localStorage.getItem(`course-versions-${course.id}`) || '[]');
      
      // Check if this is a significant change
      const lastVersion = existingVersions[0];
      const isSignificantChange = !lastVersion || 
        lastVersion.course.title !== course.title ||
        (lastVersion.course.modules?.length || 0) !== (course.modules?.length || 0) ||
        JSON.stringify(lastVersion.course.learningObjectives) !== JSON.stringify(course.learningObjectives);

      if (isSignificantChange) {
        const newVersion: CourseVersion = {
          id: `version-${Date.now()}`,
          timestamp: Date.now(),
          course: { ...course },
          changeDescription: getChangeDescription(lastVersion?.course, course),
          changedBy: 'Mya Dennis',
          changeType: getChangeType(lastVersion?.course, course)
        };

        const updatedVersions = [newVersion, ...existingVersions.slice(0, 9)]; // Keep last 10 versions
        localStorage.setItem(`course-versions-${course.id}`, JSON.stringify(updatedVersions));
        setVersions(updatedVersions);
      } else {
        setVersions(existingVersions);
      }
    }
  }, [course]);

  const getChangeDescription = (oldCourse: Course | undefined, newCourse: Course): string => {
    if (!oldCourse) return 'Course created';
    
    const changes = [];
    
    if (oldCourse.title !== newCourse.title) changes.push('title updated');
    if (oldCourse.description !== newCourse.description) changes.push('description modified');
    if ((oldCourse.modules?.length || 0) !== (newCourse.modules?.length || 0)) {
      changes.push(`modules count: ${oldCourse.modules?.length || 0} → ${newCourse.modules?.length || 0}`);
    }
    if (JSON.stringify(oldCourse.learningObjectives) !== JSON.stringify(newCourse.learningObjectives)) {
      changes.push('learning objectives updated');
    }
    
    return changes.length > 0 ? changes.join(', ') : 'minor updates';
  };

  const getChangeType = (oldCourse: Course | undefined, newCourse: Course): CourseVersion['changeType'] => {
    if (!oldCourse) return 'create';
    
    if ((oldCourse.modules?.length || 0) !== (newCourse.modules?.length || 0)) return 'structure';
    if (oldCourse.title !== newCourse.title || oldCourse.description !== newCourse.description) return 'content';
    if (oldCourse.status !== newCourse.status || oldCourse.difficulty !== newCourse.difficulty) return 'settings';
    
    return 'update';
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getChangeTypeIcon = (type: CourseVersion['changeType']) => {
    switch (type) {
      case 'create': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'structure': return <GitBranch className="h-4 w-4 text-blue-500" />;
      case 'content': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'settings': return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getChangeTypeColor = (type: CourseVersion['changeType']) => {
    switch (type) {
      case 'create': return 'bg-green-50 border-green-200';
      case 'structure': return 'bg-blue-50 border-blue-200';
      case 'content': return 'bg-orange-50 border-orange-200';
      case 'settings': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const handleRestore = (version: CourseVersion) => {
    if (window.confirm(`Are you sure you want to restore to this version from ${formatTimestamp(version.timestamp)}? All current changes will be lost.`)) {
      onRestore(version);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <History className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
            <p className="text-sm text-gray-600">Track changes and restore previous versions</p>
          </div>
        </div>
        <span className="text-sm text-gray-500">{versions.length} versions saved</span>
      </div>

      <div className="space-y-3">
        {versions.length === 0 ? (
          <div className="text-center py-8">
            <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No version history yet</p>
            <p className="text-sm text-gray-400">Changes will be automatically tracked</p>
          </div>
        ) : (
          versions.map((version, index) => (
            <div 
              key={version.id} 
              className={`border rounded-lg p-4 transition-all hover:shadow-sm ${
                index === 0 ? 'ring-2 ring-blue-100 bg-blue-50/50' : getChangeTypeColor(version.changeType)
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {getChangeTypeIcon(version.changeType)}
                    <span className="font-medium text-gray-900">
                      {index === 0 ? 'Current Version' : `Version ${versions.length - index}`}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize">
                      {version.changeType}
                    </span>
                    {index === 0 && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">{version.changeDescription}</p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{version.changedBy}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimestamp(version.timestamp)}</span>
                    </span>
                  </div>
                </div>
                
                {index > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowDiff(showDiff === version.id ? null : version.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      {showDiff === version.id ? 'Hide' : 'View'} Changes
                    </button>
                    <button
                      onClick={() => handleRestore(version)}
                      className="flex items-center space-x-1 text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restore</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Diff View */}
              {showDiff === version.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Changes in this version:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium text-gray-700">Title:</span>
                          <p className="text-gray-600 truncate">{version.course.title}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Modules:</span>
                          <p className="text-gray-600">{version.course.modules?.length || 0} modules</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Status:</span>
                          <p className="text-gray-600 capitalize">{version.course.status}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Duration:</span>
                          <p className="text-gray-600">{version.course.duration}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {versions.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2 text-blue-700 mb-2">
            <History className="h-4 w-4" />
            <span className="font-medium text-sm">Auto-Save Enabled</span>
          </div>
          <p className="text-sm text-blue-600">
            Versions are automatically saved when you make significant changes. Up to 10 versions are kept.
          </p>
        </div>
      )}
    </div>
  );
};

export default VersionControl;