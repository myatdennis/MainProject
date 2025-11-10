import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Download, ArrowRight, CheckCircle, Star, Clock, Target, BookOpen, Award, Loader2, Linkedin, Twitter, Mail, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateFromCompletion } from '../dal/certificates';
import { trackCourseCompletion } from '../dal/analytics';
const CourseCompletion = ({ course, completionData, keyTakeaways = [], nextSteps = [], recommendedCourses = [], onClose, onCertificateDownload, onShareComplete, className = '' }) => {
    const [showConfetti, setShowConfetti] = useState(true);
    const [activeTab, setActiveTab] = useState('summary');
    const [shareUrl, setShareUrl] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    const [certificateUrl, setCertificateUrl] = useState(completionData.certificateUrl);
    const [certificateId, setCertificateId] = useState(completionData.certificateId);
    const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);
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
    const learnerProfile = useMemo(() => {
        try {
            const raw = localStorage.getItem('huddle_user');
            if (!raw)
                return null;
            return JSON.parse(raw);
        }
        catch (error) {
            console.warn('Failed to parse learner profile:', error);
            return null;
        }
    }, []);
    const learnerId = learnerProfile?.id || learnerProfile?.email || 'local-user';
    const learnerName = learnerProfile?.name || learnerProfile?.fullName || learnerProfile?.email || 'Learner';
    const learnerEmail = learnerProfile?.email || 'demo@learner.com';
    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };
    const getGradeColor = (grade) => {
        switch (grade?.toUpperCase()) {
            case 'A':
            case 'A+':
            case 'A-':
                return 'text-green-600 bg-green-50';
            case 'B':
            case 'B+':
            case 'B-':
                return 'text-blue-600 bg-blue-50';
            case 'C':
            case 'C+':
            case 'C-':
                return 'text-yellow-600 bg-yellow-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    };
    const handleShare = async (platform) => {
        const text = `Just completed "${course.title}"! 🎓 #Learning #ProfessionalDevelopment`;
        switch (platform) {
            case 'linkedin':
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(text)}`, '_blank');
                break;
            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                break;
            case 'email':
                window.open(`mailto:?subject=${encodeURIComponent(`Course Completion: ${course.title}`)}&body=${encodeURIComponent(`${text}\n\n${shareUrl}`)}`, '_blank');
                break;
            case 'copy':
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                }
                catch (err) {
                    console.error('Failed to copy link:', err);
                }
                break;
        }
        if (onShareComplete) {
            onShareComplete(platform);
        }
    };
    const totalLessons = course.modules?.reduce((acc, module) => acc + module.lessons.length, 0) || 0;
    const completedLessons = course.modules?.reduce((acc, module) => acc + module.lessons.filter(lesson => lesson.completed).length, 0) || 0;
    const totalModules = course.modules?.length || 0;
    const moduleRequirements = useMemo(() => {
        return (course.modules || []).map(module => `Completed module: ${module.title}`);
    }, [course.modules]);
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
    const handleGenerateCertificate = useCallback(async () => {
        setIsGeneratingCertificate(true);
        try {
            const generated = await generateFromCompletion({
                userId: learnerId,
                userName: learnerName,
                userEmail: learnerEmail,
                courseId: course.id,
                courseTitle: course.title,
                certificationName: `${course.title} Certificate`,
                completionDate: completionData.completedAt.toISOString(),
                completionTimeMinutes: completionData.timeSpent,
                finalScore: completionData.score,
                requirementsMet: moduleRequirements
            });
            setCertificateUrl(generated.certificateUrl);
            setCertificateId(generated.id);
            setActiveTab('certificate');
            toast.success('Certificate generated successfully!');
            trackCourseCompletion(learnerId, course.id, {
                totalTimeSpent: completionData.timeSpent,
                finalScore: completionData.score,
                modulesCompleted: totalModules,
                lessonsCompleted: completedLessons,
                quizzesPassed: 0,
                certificateGenerated: true
            });
        }
        catch (error) {
            console.error('Failed to generate certificate:', error);
            toast.error('Unable to generate certificate. Please try again.');
        }
        finally {
            setIsGeneratingCertificate(false);
        }
    }, [completionData.completedAt, completionData.score, completionData.timeSpent, completedLessons, course.id, course.title, learnerEmail, learnerId, learnerName, moduleRequirements, totalModules]);
    const [darkMode, setDarkMode] = useState(false);
    return (_jsxs("div", { className: `min-h-screen bg-gradient-to-br from-orange-50 to-red-50 ${className} ${darkMode ? 'dark' : ''}`, children: [showConfetti && (_jsx("div", { className: "fixed inset-0 pointer-events-none z-10", children: _jsx("div", { className: "confetti-animation", children: Array.from({ length: 50 }).map((_, i) => (_jsx("div", { className: "confetti-piece", style: {
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            backgroundColor: ['#de7b12', '#D72638', '#3A7DFF', '#228B22'][Math.floor(Math.random() * 4)]
                        } }, i))) }) })), _jsxs("div", { className: "container mx-auto px-4 py-12 relative z-20", children: [_jsxs("div", { className: "text-center mb-12", children: [_jsx("div", { className: "mb-6", children: _jsx(Trophy, { className: "h-20 w-20 text-yellow-500 mx-auto animate-bounce" }) }), _jsx("h1", { className: `text-4xl md:text-6xl font-bold mb-4 ${darkMode ? 'text-ivorywhite' : 'text-gray-900'}`, children: "Congratulations!" }), _jsxs("p", { className: `text-xl mb-6 max-w-2xl mx-auto ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`, children: ["You've successfully completed ", _jsxs("span", { className: "font-semibold text-gray-900", children: ["\"", course.title, "\""] })] }), _jsxs("div", { className: `flex flex-wrap items-center justify-center gap-6 text-sm ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`, children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Clock, { className: "h-4 w-4" }), _jsxs("span", { children: ["Completed in ", formatTime(completionData.timeSpent)] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "h-4 w-4 text-green-500" }), _jsxs("span", { children: [completedLessons, "/", totalLessons, " lessons"] })] }), completionData.grade && (_jsxs("div", { className: `flex items-center space-x-2 px-3 py-1 rounded-full ${getGradeColor(completionData.grade)} ${darkMode ? 'bg-indigo-900 text-ivorywhite' : ''}`, children: [_jsx(Star, { className: "h-4 w-4" }), _jsxs("span", { className: "font-medium", children: ["Grade: ", completionData.grade] })] })), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Target, { className: "h-4 w-4 text-blue-500" }), _jsxs("span", { children: ["Completed ", completionData.completedAt.toLocaleDateString()] })] })] })] }), _jsx("div", { className: "flex justify-center mb-8", children: _jsx("div", { className: `rounded-xl p-1 shadow-lg border ${darkMode ? 'bg-charcoal border-indigo-900' : 'bg-white border-gray-200'}`, children: [
                                { id: 'summary', label: 'Summary', icon: BookOpen },
                                { id: 'certificate', label: 'Certificate', icon: Award },
                                { id: 'next-steps', label: 'Next Steps', icon: ArrowRight }
                            ].map(({ id, label, icon: Icon }) => (_jsxs("button", { onClick: () => setActiveTab(id), className: `px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${activeTab === id
                                    ? (darkMode ? 'bg-gradient-to-r from-indigo-900 to-sunrise text-ivorywhite shadow-md' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md')
                                    : (darkMode ? 'text-mutedgrey hover:text-ivorywhite hover:bg-indigo-900/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')}`, children: [_jsx(Icon, { className: "h-4 w-4" }), _jsx("span", { children: label })] }, id))) }) }), _jsxs("div", { className: "max-w-4xl mx-auto", children: [activeTab === 'summary' && (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { className: `rounded-2xl p-8 shadow-lg border ${darkMode ? 'bg-charcoal border-indigo-900 text-ivorywhite' : 'bg-white border-gray-200'}`, children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "Course Summary" }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-start space-x-4", children: [course.thumbnail && (_jsx("img", { src: course.thumbnail, alt: course.title, className: "w-16 h-16 rounded-lg object-cover bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory", onError: (e) => {
                                                                    e.currentTarget.src = '/default-course-fallback.png';
                                                                    e.currentTarget.className += ' bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory';
                                                                }, "aria-label": `Course image for ${course.title}` })), _jsxs("div", { children: [_jsx("h3", { className: `font-semibold ${darkMode ? 'text-ivorywhite' : 'text-gray-900'}`, children: course.title }), course.instructor && (_jsxs("p", { className: `text-sm ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`, children: ["by ", course.instructor] })), course.description && (_jsx("p", { className: `text-sm mt-2 ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`, children: course.description }))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: `text-center p-4 rounded-lg ${darkMode ? 'bg-indigo-900/10' : 'bg-green-50'}`, children: [_jsx("div", { className: `text-2xl font-bold ${darkMode ? 'text-emerald' : 'text-green-600'}`, children: completedLessons }), _jsx("div", { className: `text-sm ${darkMode ? 'text-emerald' : 'text-green-600'}`, children: "Lessons Completed" })] }), _jsxs("div", { className: `text-center p-4 rounded-lg ${darkMode ? 'bg-indigo-900/10' : 'bg-blue-50'}`, children: [_jsx("div", { className: `text-2xl font-bold ${darkMode ? 'text-indigo-400' : 'text-blue-600'}`, children: formatTime(completionData.timeSpent) }), _jsx("div", { className: `text-sm ${darkMode ? 'text-indigo-400' : 'text-blue-600'}`, children: "Time Invested" })] })] }), completionData.score && (_jsxs("div", { className: `text-center p-4 rounded-lg ${darkMode ? 'bg-indigo-900/10' : 'bg-purple-50'}`, children: [_jsxs("div", { className: `text-2xl font-bold ${darkMode ? 'text-indigo-300' : 'text-purple-600'}`, children: [completionData.score, "%"] }), _jsx("div", { className: `text-sm ${darkMode ? 'text-indigo-300' : 'text-purple-600'}`, children: "Overall Score" })] }))] })] }), _jsxs("div", { className: `rounded-2xl p-8 shadow-lg border ${darkMode ? 'bg-charcoal border-indigo-900 text-ivorywhite' : 'bg-white border-gray-200'}`, children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "Key Takeaways" }), keyTakeaways.length > 0 ? (_jsx("ul", { className: "space-y-4", children: keyTakeaways.map((takeaway, index) => (_jsxs("li", { className: "flex items-start space-x-3", children: [_jsx("div", { className: `flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold ${darkMode ? 'bg-gradient-to-r from-indigo-900 to-sunrise' : 'bg-gradient-to-r from-orange-400 to-red-500'}`, children: index + 1 }), _jsx("span", { className: "text-gray-700", children: takeaway })] }, index))) })) : (_jsxs("div", { className: "text-center text-gray-500 py-8", children: [_jsx(BookOpen, { className: "h-12 w-12 mx-auto mb-4 text-gray-300" }), _jsx("p", { children: "No specific takeaways recorded for this course." })] })), _jsxs("div", { className: "mt-8 pt-6 border-t border-gray-200", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-4", children: "Share Your Achievement" }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("button", { onClick: () => handleShare('linkedin'), className: "flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors", children: [_jsx(Linkedin, { className: "h-4 w-4" }), _jsx("span", { children: "LinkedIn" })] }), _jsxs("button", { onClick: () => handleShare('twitter'), className: "flex items-center space-x-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors", children: [_jsx(Twitter, { className: "h-4 w-4" }), _jsx("span", { children: "Twitter" })] }), _jsxs("button", { onClick: () => handleShare('email'), className: "flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors", children: [_jsx(Mail, { className: "h-4 w-4" }), _jsx("span", { children: "Email" })] }), _jsxs("button", { onClick: () => handleShare('copy'), className: "flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors", children: [_jsx(Copy, { className: "h-4 w-4" }), _jsx("span", { children: copySuccess ? 'Copied!' : 'Copy Link' })] })] })] })] })] })), activeTab === 'certificate' && (_jsxs("div", { className: "bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center", children: [_jsx(Award, { className: "h-16 w-16 text-yellow-500 mx-auto mb-6" }), _jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Your Certificate" }), certificateUrl ? (_jsxs("div", { className: "space-y-6", children: [_jsx("p", { className: "text-gray-600", children: "Congratulations! Your certificate is ready for download." }), _jsxs("div", { className: "bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200", children: [_jsx("div", { className: "font-semibold text-gray-900 mb-2", children: "Certificate of Completion" }), _jsx("div", { className: "text-sm text-gray-600 mb-4", children: course.title }), _jsxs("div", { className: "text-xs text-gray-500", children: ["Certificate ID: ", certificateId] })] }), _jsxs("div", { className: "flex justify-center space-x-4", children: [_jsxs("button", { onClick: handleCertificateDownloadInternal, className: "bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg flex items-center space-x-2", children: [_jsx(Download, { className: "h-5 w-5" }), _jsx("span", { children: "Download Certificate" })] }), _jsxs("a", { href: certificateUrl, target: "_blank", rel: "noopener noreferrer", className: "bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200 flex items-center space-x-2", children: [_jsx(ExternalLink, { className: "h-5 w-5" }), _jsx("span", { children: "View Certificate" })] })] })] })) : (_jsxs("div", { className: "space-y-6", children: [_jsx("p", { className: "text-gray-600", children: "Generate your certificate instantly once you are ready." }), _jsx("button", { onClick: handleGenerateCertificate, disabled: isGeneratingCertificate, className: "bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg flex items-center space-x-2 mx-auto disabled:opacity-60 disabled:cursor-not-allowed", children: isGeneratingCertificate ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "h-5 w-5 animate-spin" }), _jsx("span", { children: "Preparing certificate\u2026" })] })) : (_jsxs(_Fragment, { children: [_jsx(Award, { className: "h-5 w-5" }), _jsx("span", { children: "Generate Certificate" })] })) })] }))] })), activeTab === 'next-steps' && (_jsxs("div", { className: "space-y-8", children: [nextSteps.length > 0 && (_jsxs("div", { className: "bg-white rounded-2xl p-8 shadow-lg border border-gray-200", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "Recommended Next Steps" }), _jsx("div", { className: "grid gap-6", children: nextSteps.map((step, index) => (_jsxs("div", { className: "flex items-start space-x-4 p-4 bg-gray-50 rounded-xl", children: [_jsx("div", { className: "flex-shrink-0 w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold", children: index + 1 }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-2", children: step.title }), _jsx("p", { className: "text-gray-600 mb-3", children: step.description }), (step.action || step.href) && (_jsxs("button", { onClick: step.action, className: "text-orange-600 hover:text-orange-700 font-medium text-sm flex items-center space-x-1", children: [_jsx("span", { children: "Get Started" }), _jsx(ArrowRight, { className: "h-4 w-4" })] }))] })] }, index))) })] })), recommendedCourses.length > 0 && (_jsxs("div", { className: "bg-white rounded-2xl p-8 shadow-lg border border-gray-200", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "Continue Learning" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: recommendedCourses.map((recCourse) => (_jsxs("div", { className: "border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow", children: [_jsx("img", { src: recCourse.thumbnail, alt: recCourse.title, className: "w-full h-32 object-cover rounded-xl bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory", onError: (e) => {
                                                                e.currentTarget.src = '/default-course-fallback.png';
                                                                e.currentTarget.className += ' bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory';
                                                            }, "aria-label": `Course image for ${recCourse.title}` }), _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-2", children: recCourse.title }), _jsxs("div", { className: "flex items-center justify-between text-sm text-gray-600 mb-4", children: [_jsx("span", { children: recCourse.duration }), _jsx("span", { className: "bg-gray-100 px-2 py-1 rounded", children: recCourse.difficulty })] }), _jsx("button", { className: "w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-200", children: "Start Course" })] })] }, recCourse.id))) })] }))] }))] }), _jsxs("div", { className: "text-center mt-12", children: [_jsx("div", { className: "space-y-4", children: _jsx("button", { onClick: onClose, className: `px-8 py-3 rounded-xl font-medium transition-all duration-200 border ${darkMode ? 'bg-charcoal text-ivorywhite border-indigo-900 hover:bg-indigo-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`, children: "Return to Courses" }) }), _jsx("div", { className: "mt-8 flex justify-end", children: _jsx("button", { onClick: () => setDarkMode(!darkMode), className: "px-4 py-2 rounded-xl bg-charcoal text-ivorywhite font-heading hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500", "aria-label": darkMode ? 'Switch to light mode' : 'Switch to dark mode', children: darkMode ? 'Light Mode' : 'Dark Mode' }) })] })] }), _jsx("style", { children: `
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
      ` })] }));
};
export default CourseCompletion;
