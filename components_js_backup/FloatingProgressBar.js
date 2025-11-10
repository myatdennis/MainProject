import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Trophy, Clock, Zap, Target } from 'lucide-react';
const FloatingProgressBar = ({ currentProgress, totalLessons, completedLessons, currentLessonTitle, onPrevious, onNext, hasPrevious = false, hasNext = false, estimatedTimeRemaining, visible = true, className = '' }) => {
    const [showCelebration, setShowCelebration] = useState(false);
    const [lastProgress, setLastProgress] = useState(currentProgress);
    const [isSticky, setIsSticky] = useState(false);
    // Handle milestone celebrations
    useEffect(() => {
        if (currentProgress > lastProgress) {
            const milestones = [25, 50, 75, 100];
            const crossedMilestone = milestones.find(milestone => lastProgress < milestone && currentProgress >= milestone);
            if (crossedMilestone) {
                setShowCelebration(true);
                setTimeout(() => setShowCelebration(false), 3000);
            }
        }
        setLastProgress(currentProgress);
    }, [currentProgress, lastProgress]);
    // Handle scroll for sticky behavior
    useEffect(() => {
        const handleScroll = () => {
            setIsSticky(window.scrollY > 100);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    const getMilestoneMessage = () => {
        if (currentProgress >= 100)
            return "🎉 Congratulations! Course completed!";
        if (currentProgress >= 75)
            return "🚀 Almost there! You're doing great!";
        if (currentProgress >= 50)
            return "💪 Halfway through! Keep it up!";
        if (currentProgress >= 25)
            return "⭐ Great progress! You're on track!";
        return "";
    };
    // Progress visuals are standardized to the design token gradient (Blue→Green)
    if (!visible)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: `fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${isSticky ? 'translate-y-0' : 'translate-y-0'} ${className}`, children: _jsxs("div", { className: "bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 min-w-[400px] max-w-2xl backdrop-blur-sm bg-opacity-95", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full", style: { background: 'var(--gradient-blue-green)' } }), _jsxs("span", { className: "text-sm font-semibold text-gray-900", children: [completedLessons, " of ", totalLessons, " lessons"] })] }), currentProgress === 100 && (_jsx(Trophy, { className: "h-5 w-5 text-yellow-500 animate-pulse" }))] }), _jsxs("div", { className: "flex items-center space-x-4", children: [estimatedTimeRemaining && (_jsxs("div", { className: "flex items-center text-xs text-gray-600", children: [_jsx(Clock, { className: "h-4 w-4 mr-1" }), estimatedTimeRemaining, " left"] })), _jsxs("div", { className: "text-sm font-bold text-gray-900", children: [Math.round(currentProgress), "%"] })] })] }), _jsxs("div", { className: "relative mb-3", children: [_jsx("div", { className: "w-full bg-gray-200 rounded-full h-3 overflow-hidden", children: _jsx("div", { className: `h-3 rounded-full transition-all duration-500 relative`, style: { width: `${currentProgress}%`, background: 'var(--gradient-blue-green)' }, children: _jsx("div", { className: "absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse" }) }) }), _jsx("div", { className: "absolute top-0 left-0 w-full h-3 flex justify-between items-center", children: [25, 50, 75, 100].map(milestone => (_jsx("div", { className: `w-1 h-5 -mt-1 rounded-full transition-colors duration-300 ${currentProgress >= milestone
                                            ? 'bg-white shadow-md'
                                            : 'bg-gray-300'}`, style: { marginLeft: milestone === 25 ? '25%' : milestone === 50 ? '25%' : milestone === 75 ? '25%' : '25%' } }, milestone))) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-gray-900 truncate", children: currentLessonTitle }), showCelebration && (_jsx("div", { className: "text-xs text-green-600 font-medium animate-bounce mt-1", children: getMilestoneMessage() }))] }), _jsxs("div", { className: "flex items-center space-x-2 ml-4", children: [_jsx("button", { onClick: onPrevious, disabled: !hasPrevious, className: `p-2 rounded-lg transition-all duration-200 ${hasPrevious
                                                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                                : 'text-gray-300 cursor-not-allowed'}`, title: "Previous lesson", children: _jsx(ChevronLeft, { className: "h-5 w-5" }) }), _jsx("button", { onClick: onNext, disabled: !hasNext, className: `p-2 rounded-lg transition-all duration-200 ${hasNext
                                                ? 'btn-cta shadow-lg'
                                                : 'text-gray-300 cursor-not-allowed bg-gray-200'}`, title: hasNext ? 'Next lesson' : 'Course complete', children: currentProgress >= 100 ? (_jsx(Trophy, { className: "h-5 w-5" })) : (_jsx(ChevronRight, { className: "h-5 w-5" })) })] })] })] }) }), showCelebration && currentProgress >= 100 && (_jsx("div", { className: "fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm", children: _jsxs("div", { className: "bg-white rounded-3xl p-8 max-w-md mx-4 text-center animate-bounce-in", children: [_jsx("div", { className: "mb-6", children: _jsx(Trophy, { className: "h-16 w-16 text-yellow-500 mx-auto animate-pulse" }) }), _jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-2", children: "\uD83C\uDF89 Congratulations!" }), _jsx("p", { className: "text-gray-600 mb-6", children: "You've successfully completed the course! Your certificate is ready for download." }), _jsxs("div", { className: "flex items-center justify-center space-x-4", children: [_jsx("button", { className: "btn-cta px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg", children: "Download Certificate" }), _jsx("button", { onClick: () => setShowCelebration(false), className: "text-gray-600 hover:text-gray-900 px-6 py-3 font-medium", children: "Continue" })] })] }) })), isSticky && (_jsx("div", { className: "fixed top-0 left-0 right-0 z-40", children: _jsx("div", { className: `h-1 transition-all duration-300`, style: { width: `${currentProgress}%`, background: 'var(--gradient-blue-green)' } }) })), showCelebration && currentProgress < 100 && (_jsx("div", { className: "fixed top-6 right-6 z-50 animate-slide-in-right", children: _jsx("div", { className: "bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-w-sm", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "flex-shrink-0", children: currentProgress >= 75 ? (_jsx(Zap, { className: "h-8 w-8 text-blue-500" })) : currentProgress >= 50 ? (_jsx(Target, { className: "h-8 w-8 text-purple-500" })) : (_jsx(CheckCircle, { className: "h-8 w-8 text-orange-500" })) }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-gray-900 text-sm", children: "Milestone Reached!" }), _jsx("div", { className: "text-xs text-gray-600", children: getMilestoneMessage() })] })] }) }) }))] }));
};
export default FloatingProgressBar;
