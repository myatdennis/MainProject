import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { MessageSquare, Star, Send, CheckCircle, ThumbsUp, AlertCircle, Lightbulb } from 'lucide-react';
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
    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? e.target.checked : value
        }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        // In a real app, this would send the feedback to your backend
        setIsSubmitted(true);
    };
    const getRatingText = (rating) => {
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
        return (_jsx("div", { className: "p-6 max-w-4xl mx-auto", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-12 text-center", children: [_jsx("div", { className: "bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6", children: _jsx(CheckCircle, { className: "h-12 w-12 text-green-500" }) }), _jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-6", children: "Thank You for Your Feedback!" }), _jsx("p", { className: "text-xl text-gray-600 mb-8", children: "Your input helps us continuously improve the learning experience. Mya Dennis personally reviews all feedback to ensure we're meeting your needs." }), _jsxs("div", { className: "bg-orange-50 p-6 rounded-lg mb-8", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-2", children: "What happens next?" }), _jsxs("ul", { className: "text-left space-y-2 text-gray-700", children: [_jsx("li", { children: "\u2022 Your feedback will be reviewed within 48 hours" }), _jsx("li", { children: "\u2022 If you reported a technical issue, we'll investigate immediately" }), _jsx("li", { children: "\u2022 Suggestions for improvements will be considered for future updates" }), _jsx("li", { children: "\u2022 You may receive a follow-up email if we need clarification" })] })] }), _jsx("button", { onClick: () => setIsSubmitted(false), className: "bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200", children: "Submit More Feedback" })] }) }));
    }
    return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Submit Feedback" }), _jsx("p", { className: "text-gray-600", children: "Your feedback helps us create better learning experiences. We read every submission and use your input to improve our courses." })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900 mb-4", children: "What type of feedback would you like to share?" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: feedbackTypes.map((type) => {
                            const Icon = type.icon;
                            return (_jsxs("button", { onClick: () => setFeedbackType(type.id), className: `p-4 rounded-lg border-2 transition-all duration-200 text-left ${feedbackType === type.id
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'}`, children: [_jsxs("div", { className: "flex items-center space-x-3 mb-2", children: [_jsx(Icon, { className: `h-6 w-6 ${type.color}` }), _jsx("h3", { className: "font-semibold text-gray-900", children: type.title })] }), _jsx("p", { className: "text-sm text-gray-600", children: type.description })] }, type.id));
                        }) })] }), _jsx("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-8", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-4", children: "Overall Rating" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "flex items-center space-x-1", children: [1, 2, 3, 4, 5].map((star) => (_jsx("button", { type: "button", onClick: () => setRating(star), onMouseEnter: () => setHoverRating(star), onMouseLeave: () => setHoverRating(0), className: "text-2xl transition-colors duration-200", children: _jsx(Star, { className: `h-8 w-8 ${star <= (hoverRating || rating)
                                                        ? 'text-yellow-400 fill-current'
                                                        : 'text-gray-300'}` }) }, star))) }), _jsx("span", { className: "text-lg font-medium text-gray-700 ml-4", children: getRatingText(hoverRating || rating) })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "module", className: "block text-sm font-medium text-gray-700 mb-2", children: "Related Module (Optional)" }), _jsxs("select", { id: "module", name: "module", value: formData.module, onChange: handleInputChange, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select a module" }), modules.map((module) => (_jsx("option", { value: module, children: module }, module)))] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "subject", className: "block text-sm font-medium text-gray-700 mb-2", children: "Subject *" }), _jsx("input", { type: "text", id: "subject", name: "subject", value: formData.subject, onChange: handleInputChange, required: true, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Brief summary of your feedback" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "message", className: "block text-sm font-medium text-gray-700 mb-2", children: "Your Feedback *" }), _jsx("textarea", { id: "message", name: "message", value: formData.message, onChange: handleInputChange, required: true, rows: 6, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Please share your detailed feedback, suggestions, or concerns..." })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "improvement", className: "block text-sm font-medium text-gray-700 mb-2", children: "How can we improve?" }), _jsx("textarea", { id: "improvement", name: "improvement", value: formData.improvement, onChange: handleInputChange, rows: 4, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "What specific changes or additions would make this better?" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "recommend", className: "block text-sm font-medium text-gray-700 mb-2", children: "Would you recommend this course to others?" }), _jsxs("select", { id: "recommend", name: "recommend", value: formData.recommend, onChange: handleInputChange, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select an option" }), _jsx("option", { value: "definitely", children: "Definitely" }), _jsx("option", { value: "probably", children: "Probably" }), _jsx("option", { value: "maybe", children: "Maybe" }), _jsx("option", { value: "probably-not", children: "Probably not" }), _jsx("option", { value: "definitely-not", children: "Definitely not" })] })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { id: "anonymous", name: "anonymous", type: "checkbox", checked: formData.anonymous, onChange: handleInputChange, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("label", { htmlFor: "anonymous", className: "ml-2 block text-sm text-gray-700", children: "Submit this feedback anonymously" })] }), _jsxs("button", { type: "submit", className: "w-full bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2", children: [_jsx(Send, { className: "h-5 w-5" }), _jsx("span", { children: "Submit Feedback" })] })] }) }), _jsxs("div", { className: "mt-8 bg-blue-50 rounded-xl p-6", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Your Voice Matters" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3", children: _jsx(MessageSquare, { className: "h-6 w-6 text-blue-500" }) }), _jsx("h4", { className: "font-semibold text-gray-900 mb-2", children: "We Listen" }), _jsx("p", { className: "text-sm text-gray-600", children: "Every piece of feedback is read and considered for course improvements." })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3", children: _jsx(Lightbulb, { className: "h-6 w-6 text-green-500" }) }), _jsx("h4", { className: "font-semibold text-gray-900 mb-2", children: "We Improve" }), _jsx("p", { className: "text-sm text-gray-600", children: "Your suggestions directly influence our content updates and new features." })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3", children: _jsx(CheckCircle, { className: "h-6 w-6 text-orange-500" }) }), _jsx("h4", { className: "font-semibold text-gray-900 mb-2", children: "We Respond" }), _jsx("p", { className: "text-sm text-gray-600", children: "You'll receive acknowledgment and updates on how we're addressing your feedback." })] })] })] })] }));
};
export default LMSFeedback;
