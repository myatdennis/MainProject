import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LazyImage } from './PerformanceComponents';
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
  Loader2,
  Linkedin,
  Twitter,
  Mail,
  Copy,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateFromCompletion } from '../dal/certificates';
import { trackCourseCompletion } from '../dal/analytics';
import type { Course } from '../types/courseTypes';
import { useUserProfile } from '../hooks/useUserProfile';

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
  certification?: Course['certification'];
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
  certification,
  onCertificateDownload,
  onShareComplete,
  className = ''
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'certificate' | 'next-steps'>('summary');
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string | undefined>(completionData.certificateUrl);
  const [certificateId, setCertificateId] = useState<string | undefined>(completionData.certificateId);
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);
  const [autoGenerationError, setAutoGenerationError] = useState<string | null>(null);
  const autoGenerationAttemptedRef = useRef(false);
  const hasLoggedCertificateAnalyticsRef = useRef(false);

  useEffect(() => {
    // Generate shareable URL
    const url = `${window.location.origin}/course/${course.id}/completed`;
    setShareUrl(url);

    // Hide confetti after animation
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [course.id]);

  useEffect(() => {
    setCertificateUrl(completionData.certificateUrl);
    setCertificateId(completionData.certificateId);
  }, [completionData.certificateId, completionData.certificateUrl]);

  const { user } = useUserProfile();
  const learnerIdentity = useMemo(() => {
    const fallback = { id: 'local-user', name: 'Learner', email: 'demo@learner.com' };
    if (!user) {
      return fallback;
    }
    const id = (user.email || user.id || fallback.id).toLowerCase();
    const email = user.email || fallback.email;
    const derivedName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const name = derivedName || user.email || fallback.name;
    return { id, name, email };
  }, [user]);

  const learnerId = learnerIdentity.id;
  const learnerName = learnerIdentity.name;
  const learnerEmail = learnerIdentity.email;

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
  const totalModules = course.modules?.length || 0;

  const moduleRequirements = useMemo(() => {
    const modules = course.modules || [];
    if (!modules.length) {
      return ['Complete all course modules'];
    }
    return modules.map(module => `Completed module: ${module.title}`);
  }, [course.modules]);

  const certificateDisplayName = certification?.name || `${course.title} Certificate`;

  const requirementChecklist = useMemo(() => {
    const sourceRequirements = certification?.requirements?.length
      ? certification.requirements
      : moduleRequirements;

    if (!sourceRequirements.length) {
      return [{ label: 'Complete course requirements', met: true }];
    }

    return sourceRequirements.map((label) => ({ label, met: true }));
  }, [certification?.requirements, moduleRequirements]);

  const issueCertificate = useCallback(async (source: 'auto' | 'manual') => {
    if (!course?.id) return;
    setIsGeneratingCertificate(true);
    setAutoGenerationError(null);

    try {
      const generated = await generateFromCompletion({
        userId: learnerId,
        userName: learnerName,
        userEmail: learnerEmail,
        courseId: course.id,
        courseTitle: course.title,
        certificationName: certificateDisplayName,
        completionDate: completionData.completedAt.toISOString(),
        completionTimeMinutes: completionData.timeSpent,
        finalScore: completionData.score,
        requirementsMet: requirementChecklist.map((item) => item.label),
      });

      setCertificateUrl(generated.certificateUrl);
      setCertificateId(generated.id);
      setActiveTab('certificate');
      toast.success(source === 'auto' ? 'Your certificate is ready!' : 'Certificate generated successfully!');

      if (!hasLoggedCertificateAnalyticsRef.current) {
        trackCourseCompletion(learnerId, course.id, {
          totalTimeSpent: completionData.timeSpent,
          finalScore: completionData.score,
          modulesCompleted: totalModules,
          lessonsCompleted: completedLessons,
          quizzesPassed: 0,
          certificateGenerated: true,
        });
        hasLoggedCertificateAnalyticsRef.current = true;
      }
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      if (source === 'auto') {
        setAutoGenerationError('We could not auto-issue your certificate. Please try again below.');
      } else {
        toast.error('Unable to generate certificate. Please try again.');
      }
    } finally {
      setIsGeneratingCertificate(false);
    }
  }, [certificateDisplayName, completionData.completedAt, completionData.score, completionData.timeSpent, completedLessons, course?.id, course.title, learnerEmail, learnerId, learnerName, requirementChecklist, totalModules]);

  const handleCertificateDownloadInternal = useCallback(() => {
    if (onCertificateDownload) {
      onCertificateDownload();
      return;
    }

    if (certificateUrl) {
      const anchor = document.createElement('a');
      anchor.href = certificateUrl;
      anchor.download = `${course.title.replace(/\s+/g, '-')}-certificate.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }, [certificateUrl, course.title, onCertificateDownload]);

  const handleGenerateCertificate = useCallback(() => {
    issueCertificate('manual');
  }, [issueCertificate]);

  useEffect(() => {
    if (!certification?.available) return;
    if (certificateUrl) return;
    if (autoGenerationAttemptedRef.current) return;

    autoGenerationAttemptedRef.current = true;
    issueCertificate('auto');
  }, [certification?.available, certificateUrl, issueCertificate]);

  const [darkMode, setDarkMode] = useState(false);
  return (
  <div className={`min-h-screen bg-gradient-to-br from-orange-50 to-red-50 ${className} ${darkMode ? 'dark' : ''}`}>
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
                  backgroundColor: ['#de7b12', '#D72638', '#3A7DFF', '#228B22'][Math.floor(Math.random() * 4)]
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
          
          <h1 className={`text-4xl md:text-6xl font-bold mb-4 ${darkMode ? 'text-ivorywhite' : 'text-gray-900'}`}> 
            Congratulations!
          </h1>
          
          <p className={`text-xl mb-6 max-w-2xl mx-auto ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`}> 
            You've successfully completed <span className="font-semibold text-gray-900">"{course.title}"</span>
          </p>

          <div className={`flex flex-wrap items-center justify-center gap-6 text-sm ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`}> 
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Completed in {formatTime(completionData.timeSpent)}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{completedLessons}/{totalLessons} lessons</span>
            </div>
            
            {completionData.grade && (
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getGradeColor(completionData.grade)} ${darkMode ? 'bg-indigo-900 text-ivorywhite' : ''}`}> 
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
          <div className={`rounded-xl p-1 shadow-lg border ${darkMode ? 'bg-charcoal border-indigo-900' : 'bg-white border-gray-200'}`}> 
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
                    ? (darkMode ? 'bg-gradient-to-r from-indigo-900 to-sunrise text-ivorywhite shadow-md' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md')
                    : (darkMode ? 'text-mutedgrey hover:text-ivorywhite hover:bg-indigo-900/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')
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
              <div className={`rounded-2xl p-8 shadow-lg border ${darkMode ? 'bg-charcoal border-indigo-900 text-ivorywhite' : 'bg-white border-gray-200'}`}> 
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Course Summary</h2>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    {course.thumbnail && (
                      <LazyImage
                        src={course.thumbnail}
                        webpSrc={course.thumbnail.replace(/\.(png|jpg|jpeg)$/, '.webp')}
                        avifSrc={course.thumbnail.replace(/\.(png|jpg|jpeg)$/, '.avif')}
                        srcSet={`${course.thumbnail} 1x, ${course.thumbnail.replace(/\.(png|jpg|jpeg)$/, '@2x.$1')} 2x`}
                        sizes="64px"
                        alt={course.title}
                        fallbackSrc="/default-course-fallback.png"
                        className="w-16 h-16 rounded-lg object-cover bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory"
                        aria-label={`Course image for ${course.title}`}
                        placeholder={<div className="w-16 h-16 rounded-lg bg-mutedgrey animate-pulse" />}
                      />
                    )}
                    <div>
                      <h3 className={`font-semibold ${darkMode ? 'text-ivorywhite' : 'text-gray-900'}`}>{course.title}</h3>
                      {course.instructor && (
                        <p className={`text-sm ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`}>by {course.instructor}</p>
                      )}
                      {course.description && (
                        <p className={`text-sm mt-2 ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`}>{course.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className={`text-center p-4 rounded-lg ${darkMode ? 'bg-indigo-900/10' : 'bg-green-50'}`}>
                      <div className={`text-2xl font-bold ${darkMode ? 'text-emerald' : 'text-green-600'}`}>{completedLessons}</div>
                      <div className={`text-sm ${darkMode ? 'text-emerald' : 'text-green-600'}`}>Lessons Completed</div>
                    </div>
                    
                    <div className={`text-center p-4 rounded-lg ${darkMode ? 'bg-indigo-900/10' : 'bg-blue-50'}`}>
                      <div className={`text-2xl font-bold ${darkMode ? 'text-indigo-400' : 'text-blue-600'}`}>{formatTime(completionData.timeSpent)}</div>
                      <div className={`text-sm ${darkMode ? 'text-indigo-400' : 'text-blue-600'}`}>Time Invested</div>
                    </div>
                  </div>

                  {completionData.score && (
                    <div className={`text-center p-4 rounded-lg ${darkMode ? 'bg-indigo-900/10' : 'bg-purple-50'}`}>
                      <div className={`text-2xl font-bold ${darkMode ? 'text-indigo-300' : 'text-purple-600'}`}>{completionData.score}%</div>
                      <div className={`text-sm ${darkMode ? 'text-indigo-300' : 'text-purple-600'}`}>Overall Score</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Key Takeaways */}
              <div className={`rounded-2xl p-8 shadow-lg border ${darkMode ? 'bg-charcoal border-indigo-900 text-ivorywhite' : 'bg-white border-gray-200'}`}> 
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Takeaways</h2>
                
                {keyTakeaways.length > 0 ? (
                  <ul className="space-y-4">
                    {keyTakeaways.map((takeaway, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold ${darkMode ? 'bg-gradient-to-r from-indigo-900 to-sunrise' : 'bg-gradient-to-r from-orange-400 to-red-500'}`}> 
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
              {autoGenerationError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Automatic issuance failed</p>
                    <p className="text-sm text-amber-700">{autoGenerationError}</p>
                  </div>
                </div>
              )}
              {!certificateUrl && certification?.available && !autoGenerationError && isGeneratingCertificate && (
                <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-800 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Issuing certificate…
                </div>
              )}
              
              {certificateUrl ? (
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
                      Certificate ID: {certificateId}
                    </div>
                  </div>

                  {requirementChecklist.length > 0 && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-left">
                      <p className="text-sm font-semibold text-emerald-800 mb-3">Requirements met</p>
                      <ul className="space-y-2 text-sm text-emerald-900">
                        {requirementChecklist.map((item) => (
                          <li key={item.label} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={handleCertificateDownloadInternal}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg flex items-center space-x-2"
                    >
                      <Download className="h-5 w-5" />
                      <span>Download Certificate</span>
                    </button>
                    
                    <a
                      href={certificateUrl}
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
                    Generate your certificate instantly once you are ready.
                  </p>

                  {requirementChecklist.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left">
                      <p className="text-sm font-semibold text-gray-900 mb-3">Ready to issue</p>
                      <ul className="space-y-2 text-sm text-gray-700">
                        {requirementChecklist.map((item) => (
                          <li key={item.label} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateCertificate}
                    disabled={isGeneratingCertificate}
                    className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg flex items-center space-x-2 mx-auto disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isGeneratingCertificate ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Preparing certificate…</span>
                      </>
                    ) : (
                      <>
                        <Award className="h-5 w-5" />
                        <span>Generate Certificate</span>
                      </>
                    )}
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
                        <LazyImage
                          src={recCourse.thumbnail}
                          webpSrc={recCourse.thumbnail.replace(/\.(png|jpg|jpeg)$/, '.webp')}
                          avifSrc={recCourse.thumbnail.replace(/\.(png|jpg|jpeg)$/, '.avif')}
                          srcSet={`${recCourse.thumbnail} 1x, ${recCourse.thumbnail.replace(/\.(png|jpg|jpeg)$/, '@2x.$1')} 2x`}
                          sizes="100vw"
                          alt={recCourse.title}
                          fallbackSrc="/default-course-fallback.png"
                          className="w-full h-32 object-cover rounded-xl bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory"
                          aria-label={`Course image for ${recCourse.title}`}
                          placeholder={<div className="w-full h-32 rounded-xl bg-mutedgrey animate-pulse" />}
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
              className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 border ${darkMode ? 'bg-charcoal text-ivorywhite border-indigo-900 hover:bg-indigo-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              Return to Courses
            </button>
          </div>
          {/* Dark mode toggle for Course Completion */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-4 py-2 rounded-xl bg-charcoal text-ivorywhite font-heading hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? 'Light Mode' : 'Dark Mode'}
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
