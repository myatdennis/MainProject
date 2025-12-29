import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink } from 'lucide-react';
import { Course, Module, Lesson } from '../types/courseTypes';
import SurveyQueueStatus from './Survey/SurveyQueueStatus';

interface LivePreviewProps {
  course: Course;
  currentModule?: Module;
  currentLesson?: Lesson;
  isOpen: boolean;
  onClose: () => void;
}

type PreviewMode = 'desktop' | 'tablet' | 'mobile';
type ViewType = 'learner' | 'instructor';

const LivePreview: React.FC<LivePreviewProps> = ({
  course,
  currentModule,
  currentLesson,
  isOpen,
  onClose
}) => {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [viewType, setViewType] = useState<ViewType>('learner');
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh preview when course content changes
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [course, currentModule, currentLesson]);

  const getPreviewDimensions = () => {
    switch (previewMode) {
      case 'mobile':
        return { width: '375px', height: '667px' };
      case 'tablet':
        return { width: '768px', height: '1024px' };
      case 'desktop':
      default:
        return { width: '100%', height: '100%' };
    }
  };

  const generatePreviewUrl = () => {
    const baseUrl = window.location.origin;
    if (currentLesson && currentModule) {
      return `${baseUrl}/lms/module/${currentModule.id}/lesson/${currentLesson.id}?preview=true`;
    }
    return `${baseUrl}/lms/course/${course.id}?preview=true`;
  };

  if (!isOpen) return null;

  const dimensions = getPreviewDimensions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Preview Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">Live Preview</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">View as:</span>
              <select
                value={viewType}
                onChange={(e) => setViewType(e.target.value as ViewType)}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
              >
                <option value="learner">Learner</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Device Toggle Buttons */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`p-2 rounded transition-colors ${
                  previewMode === 'desktop' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Desktop View"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPreviewMode('tablet')}
                className={`p-2 rounded transition-colors ${
                  previewMode === 'tablet' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Tablet View"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`p-2 rounded transition-colors ${
                  previewMode === 'mobile' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Mobile View"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="p-2 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors"
              title="Refresh Preview"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <a
              href={generatePreviewUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors"
              title="Close Preview"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          <SurveyQueueStatus
            variant="inline"
            showFlushButton
            dataTestId="live-preview-queue-status"
            className="text-gray-600"
          />
        </div>

        {/* Preview Content */}
        <div className="flex-1 flex items-center justify-center bg-gray-100 p-4">
          <div 
            className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${
              previewMode === 'mobile' ? 'border-8 border-gray-800' : 
              previewMode === 'tablet' ? 'border-4 border-gray-600' : ''
            }`}
            style={{
              width: dimensions.width,
              height: dimensions.height,
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          >
            <iframe
              key={refreshKey}
              src={generatePreviewUrl()}
              className="w-full h-full border-0"
              title="Course Preview"
              sandbox="allow-same-origin allow-scripts allow-forms"
            />
          </div>
        </div>

        {/* Preview Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>📱 {previewMode.charAt(0).toUpperCase() + previewMode.slice(1)} Preview</span>
              <span>•</span>
              <span>👤 {viewType.charAt(0).toUpperCase() + viewType.slice(1)} View</span>
              {currentLesson && (
                <>
                  <span>•</span>
                  <span>📖 {currentLesson.title}</span>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live Preview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePreview;