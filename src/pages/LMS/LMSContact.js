import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Calendar, Mail, Phone, Clock, MessageSquare, Video, CheckCircle, Send } from 'lucide-react';
const LMSContact = () => {
    const [contactType, setContactType] = useState('coaching');
    const [formData, setFormData] = useState({
        subject: '',
        message: '',
        urgency: 'normal',
        preferredContact: 'email',
        availableTimes: ''
    });
    const [isSubmitted, setIsSubmitted] = useState(false);
    const contactOptions = [
        {
            id: 'coaching',
            title: 'Book Coaching Session',
            description: 'Schedule a 1-on-1 session with your coach',
            icon: Calendar,
            color: 'text-blue-500',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
        },
        {
            id: 'question',
            title: 'Ask a Question',
            description: 'Get help with course content or concepts',
            icon: MessageSquare,
            color: 'text-green-500',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
        },
        {
            id: 'support',
            title: 'Technical Support',
            description: 'Report issues or get technical help',
            icon: Phone,
            color: 'text-orange-500',
            bgColor: 'bg-orange-50',
            borderColor: 'border-orange-200'
        },
        {
            id: 'general',
            title: 'General Inquiry',
            description: 'Other questions or requests',
            icon: Mail,
            color: 'text-purple-500',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
        }
    ];
    const coachInfo = {
        name: 'Mya Dennis',
        title: 'Founder & Lead Facilitator',
        image: 'https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=400',
        availability: 'Monday - Friday, 9:00 AM - 5:00 PM EST',
        responseTime: 'Within 24 hours',
        specialties: ['Inclusive Leadership', 'DEI Strategy', 'Team Development', 'Organizational Change']
    };
    const upcomingSessions = [
        {
            date: 'March 15, 2025',
            time: '2:00 PM EST',
            type: 'Individual Coaching',
            duration: '60 minutes',
            status: 'confirmed'
        },
        {
            date: 'March 22, 2025',
            time: '10:00 AM EST',
            type: 'Group Q&A Session',
            duration: '45 minutes',
            status: 'available'
        }
    ];
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        // In a real app, this would send the message to your backend
        setIsSubmitted(true);
    };
    if (isSubmitted) {
        return (_jsx("div", { className: "p-6 max-w-4xl mx-auto", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-12 text-center", children: [_jsx("div", { className: "bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6", children: _jsx(CheckCircle, { className: "h-12 w-12 text-green-500" }) }), _jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-6", children: "Message Sent Successfully!" }), _jsx("p", { className: "text-xl text-gray-600 mb-8", children: contactType === 'coaching'
                            ? "Your coaching session request has been received. You'll receive a calendar invitation within 24 hours."
                            : "Your message has been sent to Mya Dennis. You can expect a response within 24 hours." }), _jsxs("div", { className: "bg-orange-50 p-6 rounded-lg mb-8", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-2", children: "What's Next?" }), _jsxs("ul", { className: "text-left space-y-2 text-gray-700", children: [_jsx("li", { children: "\u2022 You'll receive an email confirmation shortly" }), _jsxs("li", { children: ["\u2022 ", contactType === 'coaching' ? 'A calendar invitation will be sent with session details' : 'Mya will review your message and respond personally'] }), _jsx("li", { children: "\u2022 Check your email for any follow-up questions" }), _jsx("li", { children: "\u2022 Urgent matters will be prioritized for faster response" })] })] }), _jsx("button", { onClick: () => setIsSubmitted(false), className: "bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200", children: "Send Another Message" })] }) }));
    }
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Contact Your Coach" }), _jsx("p", { className: "text-gray-600", children: "Get personalized support, schedule coaching sessions, or ask questions about your learning journey." })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [_jsxs("div", { className: "lg:col-span-2", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900 mb-4", children: "How can we help you?" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: contactOptions.map((option) => {
                                            const Icon = option.icon;
                                            return (_jsxs("button", { onClick: () => setContactType(option.id), className: `p-4 rounded-lg border-2 transition-all duration-200 text-left ${contactType === option.id
                                                    ? `${option.borderColor} ${option.bgColor}`
                                                    : 'border-gray-200 hover:border-gray-300'}`, children: [_jsxs("div", { className: "flex items-center space-x-3 mb-2", children: [_jsx(Icon, { className: `h-6 w-6 ${option.color}` }), _jsx("h3", { className: "font-semibold text-gray-900", children: option.title })] }), _jsx("p", { className: "text-sm text-gray-600", children: option.description })] }, option.id));
                                        }) })] }), _jsx("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-8", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "subject", className: "block text-sm font-medium text-gray-700 mb-2", children: "Subject *" }), _jsx("input", { type: "text", id: "subject", name: "subject", value: formData.subject, onChange: handleInputChange, required: true, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: contactType === 'coaching' ? 'Coaching session request' :
                                                        contactType === 'question' ? 'Question about...' :
                                                            contactType === 'support' ? 'Technical issue with...' :
                                                                'General inquiry about...' })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "message", className: "block text-sm font-medium text-gray-700 mb-2", children: "Message *" }), _jsx("textarea", { id: "message", name: "message", value: formData.message, onChange: handleInputChange, required: true, rows: 6, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: contactType === 'coaching' ? 'Please describe what you\'d like to focus on in your coaching session and any specific challenges you\'re facing...' :
                                                        contactType === 'question' ? 'Please describe your question in detail. Include any specific modules or concepts you need help with...' :
                                                            contactType === 'support' ? 'Please describe the technical issue you\'re experiencing, including what you were trying to do and any error messages...' :
                                                                'Please provide details about your inquiry...' })] }), contactType === 'coaching' && (_jsxs("div", { children: [_jsx("label", { htmlFor: "availableTimes", className: "block text-sm font-medium text-gray-700 mb-2", children: "Your Available Times" }), _jsx("textarea", { id: "availableTimes", name: "availableTimes", value: formData.availableTimes, onChange: handleInputChange, rows: 3, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Please share your availability (days, times, time zone) so we can schedule your session..." })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "urgency", className: "block text-sm font-medium text-gray-700 mb-2", children: "Priority Level" }), _jsxs("select", { id: "urgency", name: "urgency", value: formData.urgency, onChange: handleInputChange, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "low", children: "Low - General inquiry" }), _jsx("option", { value: "normal", children: "Normal - Standard response" }), _jsx("option", { value: "high", children: "High - Need response soon" }), _jsx("option", { value: "urgent", children: "Urgent - Need immediate help" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "preferredContact", className: "block text-sm font-medium text-gray-700 mb-2", children: "Preferred Response Method" }), _jsxs("select", { id: "preferredContact", name: "preferredContact", value: formData.preferredContact, onChange: handleInputChange, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "email", children: "Email" }), _jsx("option", { value: "phone", children: "Phone call" }), _jsx("option", { value: "video", children: "Video call" })] })] })] }), _jsxs("button", { type: "submit", className: "w-full bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2", children: [_jsx(Send, { className: "h-5 w-5" }), _jsx("span", { children: contactType === 'coaching' ? 'Request Coaching Session' : 'Send Message' })] })] }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Your Coach" }), _jsxs("div", { className: "flex items-center space-x-4 mb-4", children: [_jsx("img", { src: coachInfo.image, alt: coachInfo.name, className: "w-16 h-16 rounded-full object-cover" }), _jsxs("div", { children: [_jsx("h4", { className: "font-bold text-gray-900", children: coachInfo.name }), _jsx("p", { className: "text-sm text-gray-600", children: coachInfo.title })] })] }), _jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Clock, { className: "h-4 w-4 text-gray-400" }), _jsx("span", { className: "text-gray-600", children: coachInfo.availability })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Mail, { className: "h-4 w-4 text-gray-400" }), _jsxs("span", { className: "text-gray-600", children: ["Response time: ", coachInfo.responseTime] })] })] }), _jsxs("div", { className: "mt-4", children: [_jsx("h5", { className: "font-semibold text-gray-900 mb-2", children: "Specialties:" }), _jsx("div", { className: "flex flex-wrap gap-2", children: coachInfo.specialties.map((specialty, index) => (_jsx("span", { className: "bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium", children: specialty }, index))) })] })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Upcoming Sessions" }), _jsx("div", { className: "space-y-4", children: upcomingSessions.map((session, index) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h4", { className: "font-semibold text-gray-900", children: session.type }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${session.status === 'confirmed'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-blue-100 text-blue-800'}`, children: session.status })] }), _jsxs("div", { className: "text-sm text-gray-600 space-y-1", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Calendar, { className: "h-4 w-4" }), _jsx("span", { children: session.date })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Clock, { className: "h-4 w-4" }), _jsxs("span", { children: [session.time, " (", session.duration, ")"] })] })] }), session.status === 'confirmed' && (_jsxs("a", { href: "/lms/meeting", className: "mt-3 w-full bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center space-x-2", children: [_jsx(Video, { className: "h-4 w-4" }), _jsx("span", { children: "Join Meeting" })] }))] }, index))) })] }), _jsxs("div", { className: "bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-2", children: "Need Immediate Help?" }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "For urgent technical issues or time-sensitive questions, you can reach out directly." }), _jsxs("div", { className: "space-y-2", children: [_jsxs("a", { href: "mailto:mya@thehuddleco.com", className: "flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm", children: [_jsx(Mail, { className: "h-4 w-4" }), _jsx("span", { children: "mya@thehuddleco.com" })] }), _jsxs("a", { href: "tel:+15551234567", className: "flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm", children: [_jsx(Phone, { className: "h-4 w-4" }), _jsx("span", { children: "(555) 123-4567" })] })] })] })] })] })] }));
};
export default LMSContact;
