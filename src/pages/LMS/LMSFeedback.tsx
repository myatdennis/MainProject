import React, { useState } from 'react';
import { 
  MessageSquare, 
  Star, 
  Send, 
  CheckCircle, 
  ThumbsUp, 
  ThumbsDown,
  AlertCircle,
  Lightbulb
} from 'lucide-react';

const LMSFeedback = () => {
  const [feedbackType, setFeedbackType] = useState('general');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [formData, setFormData] = useState({
    module: '',
    subject: '',
    message: '',
    improvement: '',
    recommend: '',
    anonymous: false
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const modules = [
    'Foundations of Inclusive Leadership',
    'Recognizing and Mitigating Bias',
    'Empathy in Action',
    'Courageous Conversations at Work',
    'Personal & Team Action Planning'
  ];

  const feedbackTypes = [
    {
      id: 'general',
      title: 'General Feedback',
      description: 'Overall thoughts about the learning experience',
      icon: MessageSquare,
      color: 'text-blue-500'
    },
    {
      id: 'content',
      title: 'Content Feedback',
      description: 'Specific feedback about course materials',
      icon: Lightbulb,
      color: 'text-yellow-500'
    },
    {
      id: 'technical',
      title: 'Technical Issues',
      description: 'Report bugs or technical problems',
      icon: AlertCircle,
      color: 'text-red-500'
    },
    {
      id: 'suggestion',
      title: 'Suggestions',
      description: 'Ideas for new features or improvements',
      icon: ThumbsUp,
      color: 'text-green-500'
    }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the feedback to your backend
    setIsSubmitted(true);
  };

  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'Rate your experience';
    }
  };

  if (isSubmitted) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Thank You for Your Feedback!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your input helps us continuously improve the learning experience. 
            Mya Dennis personally reviews all feedback to ensure we're meeting your needs.
          </p>
          <div className="bg-orange-50 p-6 rounded-lg mb-8">
            <h3 className="font-semibold text-gray-900 mb-2">What happens next?</h3>
            <ul className="text-left space-y-2 text-gray-700">
              <li>• Your feedback will be reviewed within 48 hours</li>
              <li>• If you reported a technical issue, we'll investigate immediately</li>
              <li>• Suggestions for improvements will be considered for future updates</li>
              <li>• You may receive a follow-up email if we need clarification</li>
            </ul>
          </div>
          <button 
            onClick={() => setIsSubmitted(false)}
            className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200"
          >
            Submit More Feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit Feedback</h1>
        <p className="text-gray-600">
          Your feedback helps us create better learning experiences. We read every submission and use your input to improve our courses.
        </p>
      </div>

      {/* Feedback Type Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">What type of feedback would you like to share?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {feedbackTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setFeedbackType(type.id)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  feedbackType === type.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <Icon className={`h-6 w-6 ${type.color}`} />
                  <h3 className="font-semibold text-gray-900">{type.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{type.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Overall Rating
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="text-2xl transition-colors duration-200"
                  >
                    <Star 
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-lg font-medium text-gray-700 ml-4">
                {getRatingText(hoverRating || rating)}
              </span>
            </div>
          </div>

          {/* Module Selection */}
          <div>
            <label htmlFor="module" className="block text-sm font-medium text-gray-700 mb-2">
              Related Module (Optional)
            </label>
            <select
              id="module"
              name="module"
              value={formData.module}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Select a module</option>
              {modules.map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject *
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Brief summary of your feedback"
            />
          </div>

          {/* Main Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Your Feedback *
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              required
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Please share your detailed feedback, suggestions, or concerns..."
            />
          </div>

          {/* Improvement Suggestions */}
          <div>
            <label htmlFor="improvement" className="block text-sm font-medium text-gray-700 mb-2">
              How can we improve?
            </label>
            <textarea
              id="improvement"
              name="improvement"
              value={formData.improvement}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="What specific changes or additions would make this better?"
            />
          </div>

          {/* Recommendation */}
          <div>
            <label htmlFor="recommend" className="block text-sm font-medium text-gray-700 mb-2">
              Would you recommend this course to others?
            </label>
            <select
              id="recommend"
              name="recommend"
              value={formData.recommend}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Select an option</option>
              <option value="definitely">Definitely</option>
              <option value="probably">Probably</option>
              <option value="maybe">Maybe</option>
              <option value="probably-not">Probably not</option>
              <option value="definitely-not">Definitely not</option>
            </select>
          </div>

          {/* Anonymous Option */}
          <div className="flex items-center">
            <input
              id="anonymous"
              name="anonymous"
              type="checkbox"
              checked={formData.anonymous}
              onChange={handleInputChange}
              className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label htmlFor="anonymous" className="ml-2 block text-sm text-gray-700">
              Submit this feedback anonymously
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
          >
            <Send className="h-5 w-5" />
            <span>Submit Feedback</span>
          </button>
        </form>
      </div>

      {/* Additional Info */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Your Voice Matters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">We Listen</h4>
            <p className="text-sm text-gray-600">Every piece of feedback is read and considered for course improvements.</p>
          </div>
          <div className="text-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lightbulb className="h-6 w-6 text-green-500" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">We Improve</h4>
            <p className="text-sm text-gray-600">Your suggestions directly influence our content updates and new features.</p>
          </div>
          <div className="text-center">
            <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="h-6 w-6 text-orange-500" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">We Respond</h4>
            <p className="text-sm text-gray-600">You'll receive acknowledgment and updates on how we're addressing your feedback.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LMSFeedback;