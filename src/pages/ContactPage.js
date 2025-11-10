import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle, Linkedin, Twitter, Instagram, Calendar } from 'lucide-react';
const ContactPage = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        organization: '',
        role: '',
        subject: '',
        message: '',
        interest: ''
    });
    const [isSubmitted, setIsSubmitted] = useState(false);
    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        // Here you would integrate with your form handling service
        setIsSubmitted(true);
    };
    const contactInfo = [
        {
            icon: _jsx(Mail, { className: "h-6 w-6 text-orange-500" }),
            title: "Email",
            details: "hello@thehuddleco.com",
            subtitle: "We respond within 24 hours"
        },
        {
            icon: _jsx(Phone, { className: "h-6 w-6 text-blue-500" }),
            title: "Phone",
            details: "(555) 123-4567",
            subtitle: "Monday - Friday, 9am - 5pm EST"
        },
        {
            icon: _jsx(MapPin, { className: "h-6 w-6 text-green-500" }),
            title: "Location",
            details: "Nationwide Service",
            subtitle: "Virtual & in-person workshops"
        },
        {
            icon: _jsx(Clock, { className: "h-6 w-6 text-purple-500" }),
            title: "Response Time",
            details: "Within 24 hours",
            subtitle: "Discovery calls scheduled within 48 hours"
        }
    ];
    const socialLinks = [
        { icon: _jsx(Linkedin, { className: "h-6 w-6" }), label: "LinkedIn", href: "#" },
        { icon: _jsx(Twitter, { className: "h-6 w-6" }), label: "Twitter", href: "#" },
        { icon: _jsx(Instagram, { className: "h-6 w-6" }), label: "Instagram", href: "#" }
    ];
    const faqItems = [
        {
            question: "What's the best way to get started?",
            answer: "The best first step is booking a free 30-minute discovery call where we'll discuss your challenges, goals, and determine the best approach for your organization."
        },
        {
            question: "How quickly can you respond to urgent needs?",
            answer: "For urgent situations requiring immediate support, we can often arrange a consultation within 24-48 hours. Contact us directly by phone for the fastest response."
        },
        {
            question: "Do you work with organizations of all sizes?",
            answer: "Yes! We work with organizations from 20-person nonprofits to Fortune 500 companies. Our approach scales to meet your specific needs and budget."
        },
        {
            question: "Can you provide references from similar organizations?",
            answer: "Absolutely. We can connect you with leaders from organizations similar to yours who can share their experience working with us."
        }
    ];
    const navigate = useNavigate();
    if (isSubmitted) {
        return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-20", children: _jsx("div", { className: "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center", children: _jsxs("div", { className: "bg-white p-12 rounded-2xl shadow-xl", children: [_jsx("div", { className: "bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6", children: _jsx(CheckCircle, { className: "h-12 w-12 text-green-500" }) }), _jsx("h1", { className: "text-3xl md:text-4xl font-bold text-gray-900 mb-6", children: "Thank You for Reaching Out!" }), _jsx("p", { className: "text-xl text-gray-600 mb-8", children: "We've received your message and will respond within 24 hours. Mya Dennis personally reviews every inquiry to ensure you get the most relevant information." }), _jsxs("div", { className: "bg-orange-50 p-6 rounded-lg mb-8", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-2", children: "What happens next?" }), _jsxs("ul", { className: "text-left space-y-2 text-gray-700", children: [_jsx("li", { children: "\u2022 We'll review your message and organizational needs" }), _jsx("li", { children: "\u2022 You'll receive a personalized response with next steps" }), _jsx("li", { children: "\u2022 If appropriate, we'll schedule a discovery call to discuss your goals" }), _jsx("li", { children: "\u2022 We'll provide you with relevant resources and case studies" })] })] }), _jsx("button", { onClick: () => navigate('/'), className: "bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200", children: "Return to Homepage" })] }) }) }));
    }
    return (_jsxs("div", { children: [_jsx("section", { className: "bg-gradient-to-br from-orange-50 to-blue-50 py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center", children: [_jsx("h1", { className: "text-4xl md:text-5xl font-bold text-gray-900 mb-6", children: "Let's Start the Conversation" }), _jsx("p", { className: "text-xl text-gray-600 mb-8 max-w-3xl mx-auto", children: "Ready to transform your organization's culture? We're here to help you create environments where everyone thrives." }), _jsxs("button", { className: "bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center mx-auto space-x-2", children: [_jsx(Calendar, { className: "h-5 w-5" }), _jsx("span", { children: "Schedule Free Discovery Call" })] })] }) }), _jsx("section", { className: "py-20", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16", children: contactInfo.map((info, index) => (_jsxs("div", { className: "bg-white p-6 rounded-2xl shadow-lg text-center", children: [_jsx("div", { className: "bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4", children: info.icon }), _jsx("h3", { className: "font-bold text-gray-900 mb-2", children: info.title }), _jsx("p", { className: "text-lg font-semibold text-gray-800 mb-1", children: info.details }), _jsx("p", { className: "text-sm text-gray-500", children: info.subtitle })] }, index))) }) }) }), _jsx("section", { className: "pb-20", children: _jsx("div", { className: "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-8 lg:p-12", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900 mb-4", children: "Get in Touch" }), _jsx("p", { className: "text-lg text-gray-600", children: "Tell us about your organization and how we can help you create positive change." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "name", className: "block text-sm font-medium text-gray-700 mb-2", children: "Full Name *" }), _jsx("input", { type: "text", id: "name", name: "name", value: formData.name, onChange: handleChange, required: true, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200", placeholder: "Enter your full name" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-gray-700 mb-2", children: "Email Address *" }), _jsx("input", { type: "email", id: "email", name: "email", value: formData.email, onChange: handleChange, required: true, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200", placeholder: "Enter your email" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "organization", className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization *" }), _jsx("input", { type: "text", id: "organization", name: "organization", value: formData.organization, onChange: handleChange, required: true, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200", placeholder: "Your company or organization" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "role", className: "block text-sm font-medium text-gray-700 mb-2", children: "Your Role *" }), _jsx("input", { type: "text", id: "role", name: "role", value: formData.role, onChange: handleChange, required: true, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200", placeholder: "Your job title or role" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "interest", className: "block text-sm font-medium text-gray-700 mb-2", children: "Primary Interest *" }), _jsxs("select", { id: "interest", name: "interest", value: formData.interest, onChange: handleChange, required: true, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200", children: [_jsx("option", { value: "", children: "Select your primary interest" }), _jsx("option", { value: "inclusive-leadership", children: "Inclusive Leadership Workshop" }), _jsx("option", { value: "courageous-conversations", children: "Courageous Conversations Training" }), _jsx("option", { value: "strategic-dei", children: "Strategic DEI Planning" }), _jsx("option", { value: "keynote-speaking", children: "Keynote Speaking" }), _jsx("option", { value: "custom-solution", children: "Custom Solution" }), _jsx("option", { value: "consultation", children: "General Consultation" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "subject", className: "block text-sm font-medium text-gray-700 mb-2", children: "Subject" }), _jsx("input", { type: "text", id: "subject", name: "subject", value: formData.subject, onChange: handleChange, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200", placeholder: "Brief subject line" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "message", className: "block text-sm font-medium text-gray-700 mb-2", children: "Message *" }), _jsx("textarea", { id: "message", name: "message", value: formData.message, onChange: handleChange, required: true, rows: 6, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200", placeholder: "Tell us about your organization, challenges, and goals. The more details you share, the better we can help you." })] }), _jsxs("button", { type: "submit", className: "w-full bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2", children: [_jsx(Send, { className: "h-5 w-5" }), _jsx("span", { children: "Send Message" })] })] }), _jsx("p", { className: "text-center text-sm text-gray-500 mt-6", children: "We typically respond to all inquiries within 24 hours. For urgent matters, please call us directly." })] }) }) }), _jsx("section", { className: "bg-gray-50 py-20", children: _jsxs("div", { className: "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center", children: "Frequently Asked Questions" }), _jsx("div", { className: "space-y-8", children: faqItems.map((item, index) => (_jsxs("div", { className: "bg-white p-6 rounded-lg shadow-sm", children: [_jsx("h3", { className: "text-xl font-bold text-gray-900 mb-3", children: item.question }), _jsx("p", { className: "text-gray-600", children: item.answer })] }, index))) })] }) }), _jsx("section", { className: "py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900 mb-8", children: "Connect with Us" }), _jsx("p", { className: "text-lg text-gray-600 mb-8 max-w-2xl mx-auto", children: "Follow our journey and get insights on inclusive leadership, DEI best practices, and organizational transformation." }), _jsx("div", { className: "flex justify-center space-x-6", children: socialLinks.map((social, index) => (_jsx("a", { href: social.href, className: "bg-white p-4 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-200 text-gray-600 hover:text-orange-500", "aria-label": social.label, children: social.icon }, index))) })] }) })] }));
};
export default ContactPage;
