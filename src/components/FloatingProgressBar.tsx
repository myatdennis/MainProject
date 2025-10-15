import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Trophy,
  Clock,
  Zap,
  Target
} from 'lucide-react';

interface FloatingProgressBarProps {
  currentProgress: number;
  totalLessons: number;
  completedLessons: number;
  currentLessonTitle: string;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  estimatedTimeRemaining?: string;
  onClose?: () => void;
  visible?: boolean;
  className?: string;
}

const FloatingProgressBar: React.FC<FloatingProgressBarProps> = ({
  currentProgress,
  totalLessons,
  completedLessons,
  currentLessonTitle,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  estimatedTimeRemaining,
  visible = true,
  className = ''
}) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastProgress, setLastProgress] = useState(currentProgress);
  const [isSticky, setIsSticky] = useState(false);

  // Handle milestone celebrations
  useEffect(() => {
    if (currentProgress > lastProgress) {
      const milestones = [25, 50, 75, 100];
      const crossedMilestone = milestones.find(
        milestone => lastProgress < milestone && currentProgress >= milestone
      );

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
    if (currentProgress >= 100) return "🎉 Congratulations! Course completed!";
    if (currentProgress >= 75) return "🚀 Almost there! You're doing great!";
    if (currentProgress >= 50) return "💪 Halfway through! Keep it up!";
    if (currentProgress >= 25) return "⭐ Great progress! You're on track!";
    return "";
  };

  const getProgressColor = () => {
    if (currentProgress >= 100) return 'from-green-400 to-emerald-500';
    if (currentProgress >= 75) return 'from-blue-400 to-indigo-500';
    if (currentProgress >= 50) return 'from-purple-400 to-pink-500';
    if (currentProgress >= 25) return 'from-yellow-400 to-orange-500';
    return 'from-orange-400 to-red-500';
  };

  if (!visible) return null;

  return (
    <>
      {/* Main Progress Bar */}
      <div 
        className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
          isSticky ? 'translate-y-0' : 'translate-y-0'
        } ${className}`}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 min-w-[400px] max-w-2xl backdrop-blur-sm bg-opacity-95">
          {/* Progress Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getProgressColor()}`} />
                <span className="text-sm font-semibold text-gray-900">
                  {completedLessons} of {totalLessons} lessons
                </span>
              </div>
              
              {currentProgress === 100 && (
                <Trophy className="h-5 w-5 text-yellow-500 animate-pulse" />
              )}
            </div>

            <div className="flex items-center space-x-4">
              {estimatedTimeRemaining && (
                <div className="flex items-center text-xs text-gray-600">
                  <Clock className="h-4 w-4 mr-1" />
                  {estimatedTimeRemaining} left
                </div>
              )}
              
              <div className="text-sm font-bold text-gray-900">
                {Math.round(currentProgress)}%
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative mb-3">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-3 rounded-full bg-gradient-to-r ${getProgressColor()} transition-all duration-500 relative`}
                style={{ width: `${currentProgress}%` }}
              >
                {/* Animated shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse" />
              </div>
            </div>

            {/* Progress milestones */}
            <div className="absolute top-0 left-0 w-full h-3 flex justify-between items-center">
              {[25, 50, 75, 100].map(milestone => (
                <div
                  key={milestone}
                  className={`w-1 h-5 -mt-1 rounded-full transition-colors duration-300 ${
                    currentProgress >= milestone 
                      ? 'bg-white shadow-md' 
                      : 'bg-gray-300'
                  }`}
                  style={{ marginLeft: milestone === 25 ? '25%' : milestone === 50 ? '25%' : milestone === 75 ? '25%' : '25%' }}
                />
              ))}
            </div>
          </div>

          {/* Current Lesson & Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {currentLessonTitle}
              </div>
              
              {showCelebration && (
                <div className="text-xs text-green-600 font-medium animate-bounce mt-1">
                  {getMilestoneMessage()}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={onPrevious}
                disabled={!hasPrevious}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  hasPrevious 
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title="Previous lesson"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                onClick={onNext}
                disabled={!hasNext}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  hasNext 
                    ? 'text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg' 
                    : 'text-gray-300 cursor-not-allowed bg-gray-200'
                }`}
                title={hasNext ? 'Next lesson' : 'Course complete'}
              >
                {currentProgress >= 100 ? (
                  <Trophy className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Celebration Modal */}
      {showCelebration && currentProgress >= 100 && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md mx-4 text-center animate-bounce-in">
            <div className="mb-6">
              <Trophy className="h-16 w-16 text-yellow-500 mx-auto animate-pulse" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              🎉 Congratulations!
            </h2>
            
            <p className="text-gray-600 mb-6">
              You've successfully completed the course! Your certificate is ready for download.
            </p>

            <div className="flex items-center justify-center space-x-4">
              <button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg">
                Download Certificate
              </button>
              
              <button 
                onClick={() => setShowCelebration(false)}
                className="text-gray-600 hover:text-gray-900 px-6 py-3 font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini Progress Indicator (Top of page when scrolled) */}
      {isSticky && (
        <div className="fixed top-0 left-0 right-0 z-40">
          <div className={`h-1 bg-gradient-to-r ${getProgressColor()} transition-all duration-300`} 
               style={{ width: `${currentProgress}%` }} />
        </div>
      )}

      {/* Achievement Notifications */}
      {showCelebration && currentProgress < 100 && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in-right">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-w-sm">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {currentProgress >= 75 ? (
                  <Zap className="h-8 w-8 text-blue-500" />
                ) : currentProgress >= 50 ? (
                  <Target className="h-8 w-8 text-purple-500" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-orange-500" />
                )}
              </div>
              
              <div>
                <div className="font-semibold text-gray-900 text-sm">
                  Milestone Reached!
                </div>
                <div className="text-xs text-gray-600">
                  {getMilestoneMessage()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingProgressBar;