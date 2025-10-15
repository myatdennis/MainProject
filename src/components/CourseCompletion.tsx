import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Download, 
  ArrowRight,
  CheckCircle,
  Star,
  Clock,
  Target,
  BookOpen,
  Award,
  Linkedin,
  Twitter,
  Mail,
  Copy,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface CourseCompletionProps {
  course: {
    id: string;
    title: string;
    description?: string;
    thumbnail?: string;
    instructor?: string;
    duration?: string;
    modules?: Array<{
      id: string;
      title: string;
      lessons: Array<{
        id: string;
        title: string;
        completed?: boolean;
      }>;
    }>;
  };
  completionData: {
    completedAt: Date;
    timeSpent: number; // in minutes
    score?: number;
    grade?: string;
    certificateId?: string;
    certificateUrl?: string;
  };
  keyTakeaways?: string[];
  nextSteps?: Array<{
    title: string;
    description: string;
    action?: () => void;
    href?: string;
  }>;
  recommendedCourses?: Array<{
    id: string;
    title: string;
    thumbnail: string;
    duration: string;
    difficulty: string;
  }>;
  onClose?: () => void;
  onCertificateDownload?: () => void;
  onShareComplete?: (platform: string) => void;
  className?: string;
}

const CourseCompletion: React.FC<CourseCompletionProps> = ({
  course,
  completionData,
  keyTakeaways = [],
  nextSteps = [],
  recommendedCourses = [],
  onClose,
  onCertificateDownload,
  onShareComplete,
  className = ''
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'certificate' | 'next-steps'>('summary');
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    // Generate shareable URL
    const url = `${window.location.origin}/course/${course.id}/completed`;
    setShareUrl(url);

    // Hide confetti after animation
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [course.id]);

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getGradeColor = (grade?: string) => {
    switch (grade?.toUpperCase()) {
      case 'A': case 'A+': case 'A-':
        return 'text-green-600 bg-green-50';
      case 'B': case 'B+': case 'B-':
        return 'text-blue-600 bg-blue-50';
      case 'C': case 'C+': case 'C-':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleShare = async (platform: string) => {
    const text = `Just completed "${course.title}"! 🎓 #Learning #ProfessionalDevelopment`;
    
    switch (platform) {
      case 'linkedin':
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(text)}`,
          '_blank'
        );
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;
      case 'email':
        window.open(
          `mailto:?subject=${encodeURIComponent(`Course Completion: ${course.title}`)}&body=${encodeURIComponent(`${text}\n\n${shareUrl}`)}`,
          '_blank'
        );
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
          console.error('Failed to copy link:', err);
        }
        break;
    }
    
    if (onShareComplete) {
      onShareComplete(platform);
    }
  };

  const totalLessons = course.modules?.reduce((acc, module) => acc + module.lessons.length, 0) || 0;
  const completedLessons = course.modules?.reduce((acc, module) => 
    acc + module.lessons.filter(lesson => lesson.completed).length, 0) || 0;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 ${className}`}>
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-10">
          <div className="confetti-animation">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  backgroundColor: ['#FF8895', '#D72638', '#3A7FFF', '#2D9B66'][Math.floor(Math.random() * 4)]
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12 relative z-20">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="mb-6">
            <Trophy className="h-20 w-20 text-yellow-500 mx-auto animate-bounce" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
            Congratulations!
          </h1>
          
          <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
            You've successfully completed <span className="font-semibold text-gray-900">"{course.title}"</span>
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Completed in {formatTime(completionData.timeSpent)}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{completedLessons}/{totalLessons} lessons</span>
            </div>
            
            {completionData.grade && (
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getGradeColor(completionData.grade)}`}>
                <Star className="h-4 w-4" />
                <span className="font-medium">Grade: {completionData.grade}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-blue-500" />
              <span>Completed {completionData.completedAt.toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-xl p-1 shadow-lg border border-gray-200">
            {[
              { id: 'summary', label: 'Summary', icon: BookOpen },
              { id: 'certificate', label: 'Certificate', icon: Award },
              { id: 'next-steps', label: 'Next Steps', icon: ArrowRight }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === id
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl mx-auto">
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Course Summary */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Course Summary</h2>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    {course.thumbnail && (
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{course.title}</h3>
                      {course.instructor && (
                        <p className="text-sm text-gray-600">by {course.instructor}</p>
                      )}
                      {course.description && (
                        <p className="text-sm text-gray-600 mt-2">{course.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{completedLessons}</div>
                      <div className="text-sm text-green-600">Lessons Completed</div>
                    </div>
                    
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{formatTime(completionData.timeSpent)}</div>
                      <div className="text-sm text-blue-600">Time Invested</div>
                    </div>
                  </div>

                  {completionData.score && (
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{completionData.score}%</div>
                      <div className="text-sm text-purple-600">Overall Score</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Key Takeaways */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Takeaways</h2>
                
                {keyTakeaways.length > 0 ? (
                  <ul className="space-y-4">
                    {keyTakeaways.map((takeaway, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {index + 1}
                        </div>
                        <span className="text-gray-700">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No specific takeaways recorded for this course.</p>
                  </div>
                )}

                {/* Share Achievement */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Share Your Achievement</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleShare('linkedin')}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Linkedin className="h-4 w-4" />
                      <span>LinkedIn</span>
                    </button>
                    
                    <button
                      onClick={() => handleShare('twitter')}
                      className="flex items-center space-x-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
                    >
                      <Twitter className="h-4 w-4" />
                      <span>Twitter</span>
                    </button>
                    
                    <button
                      onClick={() => handleShare('email')}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </button>
                    
                    <button
                      onClick={() => handleShare('copy')}
                      className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{copySuccess ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'certificate' && (
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center">
              <Award className="h-16 w-16 text-yellow-500 mx-auto mb-6" />
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Certificate</h2>
              
              {completionData.certificateUrl ? (
                <div className="space-y-6">
                  <p className="text-gray-600">
                    Congratulations! Your certificate is ready for download.
                  </p>
                  
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
                    <div className="font-semibold text-gray-900 mb-2">
                      Certificate of Completion
                    </div>
                    <div className="text-sm text-gray-600 mb-4">
                      {course.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      Certificate ID: {completionData.certificateId}
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={onCertificateDownload}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg flex items-center space-x-2"
                    >
                      <Download className="h-5 w-5" />
                      <span>Download Certificate</span>
                    </button>
                    
                    <a
                      href={completionData.certificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200 flex items-center space-x-2"
                    >
                      <ExternalLink className="h-5 w-5" />
                      <span>View Certificate</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-gray-600">
                    Your certificate is being generated. Please check back in a few minutes.
                  </p>
                  
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg flex items-center space-x-2 mx-auto"
                  >
                    <RefreshCw className="h-5 w-5" />
                    <span>Check Again</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'next-steps' && (
            <div className="space-y-8">
              {/* Custom Next Steps */}
              {nextSteps.length > 0 && (
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Recommended Next Steps</h2>
                  
                  <div className="grid gap-6">
                    {nextSteps.map((step, index) => (
                      <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                          <p className="text-gray-600 mb-3">{step.description}</p>
                          {(step.action || step.href) && (
                            <button
                              onClick={step.action}
                              className="text-orange-600 hover:text-orange-700 font-medium text-sm flex items-center space-x-1"
                            >
                              <span>Get Started</span>
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Courses */}
              {recommendedCourses.length > 0 && (
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Continue Learning</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {recommendedCourses.map((recCourse) => (
                      <div key={recCourse.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                        <img 
                          src={recCourse.thumbnail} 
                          alt={recCourse.title}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">{recCourse.title}</h3>
                          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                            <span>{recCourse.duration}</span>
                            <span className="bg-gray-100 px-2 py-1 rounded">{recCourse.difficulty}</span>
                          </div>
                          <button className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-200">
                            Start Course
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="text-center mt-12">
          <div className="space-y-4">
            <button
              onClick={onClose}
              className="bg-white text-gray-700 border border-gray-300 px-8 py-3 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
            >
              Return to Courses
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .confetti-animation {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        
        .confetti-piece {
          position: absolute;
          width: 8px;
          height: 8px;
          animation: confetti-fall 3s linear infinite;
        }
        
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes bounce-in {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CourseCompletion;