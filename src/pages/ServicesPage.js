import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// React import not required with the new JSX transform
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Target, Clock, CheckCircle, ArrowRight, Calendar } from 'lucide-react';
const ServicesPage = () => {
    const services = [
        {
            icon: _jsx(Users, { className: "h-12 w-12 text-blue-500" }),
            title: "Inclusive Leadership Mini-Workshop",
            duration: "Half-day intensive",
            price: "Starting at $2,500",
            description: "Transform your leadership approach with practical tools for creating psychological safety and empowering diverse teams.",
            features: [
                "Interactive leadership assessment",
                "Bias recognition and mitigation strategies",
                "Communication techniques for inclusive dialogue",
                "Action planning for immediate implementation",
                "Follow-up coaching session included"
            ],
            ideal: ["New leaders", "Management teams", "HR professionals", "Department heads"]
        },
        {
            icon: _jsx(MessageSquare, { className: "h-12 w-12 text-green-500" }),
            title: "Courageous Conversations Facilitation",
            duration: "Full-day workshop",
            price: "Starting at $4,000",
            description: "Navigate difficult discussions with confidence while creating safe spaces for meaningful dialogue and conflict resolution.",
            features: [
                "Framework for difficult conversations",
                "Active listening and empathy techniques",
                "De-escalation strategies",
                "Creating psychological safety",
                "Real-time practice with feedback"
            ],
            ideal: ["Leadership teams", "HR departments", "Team managers", "Conflict resolution specialists"]
        },
        {
            icon: _jsx(Target, { className: "h-12 w-12 text-orange-500" }),
            title: "Strategic DEI Planning",
            duration: "3-month engagement",
            price: "Starting at $15,000",
            description: "Develop comprehensive diversity, equity, and inclusion strategies that drive measurable organizational change.",
            features: [
                "Organizational assessment and audit",
                "Custom DEI strategy development",
                "Implementation roadmap",
                "Leadership training program",
                "Progress tracking and measurement",
                "Quarterly strategy sessions"
            ],
            ideal: ["C-suite executives", "Board members", "DEI committees", "Organizational leaders"]
        }
    ];
    const process = [
        {
            step: "1",
            title: "Discovery Call",
            description: "We'll discuss your challenges, goals, and organizational context to determine the best approach."
        },
        {
            step: "2",
            title: "Custom Proposal",
            description: "Receive a tailored proposal with specific outcomes, timeline, and investment details."
        },
        {
            step: "3",
            title: "Engagement",
            description: "Begin your transformation journey with expert facilitation and ongoing support."
        },
        {
            step: "4",
            title: "Sustained Change",
            description: "Implement lasting systems and practices that continue to drive inclusive culture."
        }
    ];
    const navigate = useNavigate();
    return (_jsxs("div", { children: [_jsx("section", { className: "bg-gradient-to-br from-orange-50 to-blue-50 py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center", children: [_jsx("h1", { className: "text-4xl md:text-5xl font-bold text-gray-900 mb-6", children: "Transform Your Organization" }), _jsx("p", { className: "text-xl text-gray-600 mb-8 max-w-3xl mx-auto", children: "Choose from our proven services designed to create inclusive, empathetic leaders and thriving organizational cultures." }), _jsxs("button", { onClick: () => navigate('/contact'), className: "bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center mx-auto space-x-2", children: [_jsx(Calendar, { className: "h-5 w-5" }), _jsx("span", { children: "Start Here - Book Discovery Call" })] })] }) }), _jsx("section", { className: "py-20", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsx("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: services.map((service, index) => (_jsxs("div", { className: "bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden", children: [_jsxs("div", { className: "p-8", children: [_jsx("div", { className: "mb-6", children: service.icon }), _jsx("h3", { className: "text-2xl font-bold text-gray-900 mb-4", children: service.title }), _jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center space-x-2 text-gray-600", children: [_jsx(Clock, { className: "h-4 w-4" }), _jsx("span", { children: service.duration })] }), _jsx("div", { className: "text-xl font-bold text-orange-500", children: service.price })] }), _jsx("p", { className: "text-gray-600 mb-6", children: service.description }), _jsxs("div", { className: "mb-6", children: [_jsx("h4", { className: "font-semibold text-gray-900 mb-3", children: "What's Included:" }), _jsx("ul", { className: "space-y-2", children: service.features.map((feature, featureIndex) => (_jsxs("li", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "h-4 w-4 text-green-500 flex-shrink-0" }), _jsx("span", { className: "text-gray-600", children: feature })] }, featureIndex))) })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h4", { className: "font-semibold text-gray-900 mb-3", children: "Ideal For:" }), _jsx("div", { className: "flex flex-wrap gap-2", children: service.ideal.map((ideal, idealIndex) => (_jsx("span", { className: "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm", children: ideal }, idealIndex))) })] })] }), _jsx("div", { className: "bg-gray-50 p-6", children: _jsxs("button", { onClick: () => navigate('/contact'), className: "w-full bg-gradient-to-r from-orange-400 to-red-500 text-white py-3 rounded-full font-semibold hover:from-orange-500 hover:to-red-600 transition-all duration-200 flex items-center justify-center space-x-2", children: [_jsx("span", { children: "Get Started" }), _jsx(ArrowRight, { className: "h-4 w-4" })] }) })] }, index))) }) }) }), _jsx("section", { className: "bg-gray-50 py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-16", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold text-gray-900 mb-6", children: "How We Work Together" }), _jsx("p", { className: "text-xl text-gray-600 max-w-3xl mx-auto", children: "Our collaborative process ensures you get exactly what your organization needs to thrive." })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-8", children: process.map((item, index) => (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "bg-gradient-to-r from-orange-400 to-red-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold", children: item.step }), _jsx("h3", { className: "text-xl font-bold text-gray-900 mb-4", children: item.title }), _jsx("p", { className: "text-gray-600", children: item.description })] }, index))) })] }) }), _jsx("section", { className: "py-20", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-12 text-center text-white", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold mb-6", children: "Need Something Custom?" }), _jsx("p", { className: "text-xl mb-8 max-w-3xl mx-auto opacity-90", children: "Every organization is unique. We create tailored solutions for keynote speaking, executive coaching, train-the-trainer programs, and long-term culture transformation initiatives." }), _jsxs("div", { className: "flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4", children: [_jsx("button", { onClick: () => navigate('/contact'), className: "bg-white text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200", children: "Discuss Custom Solutions" }), _jsx("button", { onClick: () => {
                                            // Simple demo download
                                            const link = document.createElement('a');
                                            link.href = 'data:text/plain;charset=utf-8,The Huddle Co. Service Overview\n\nOur comprehensive DEI training and consulting services are designed to transform your organization culture.';
                                            link.download = 'huddle-co-services.txt';
                                            link.click();
                                        }, className: "border-2 border-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-blue-500 transition-colors duration-200", children: "Download Service Overview" })] })] }) }) }), _jsx("section", { className: "bg-gray-50 py-20", children: _jsxs("div", { className: "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center", children: "Frequently Asked Questions" }), _jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "bg-white p-6 rounded-lg shadow-sm", children: [_jsx("h3", { className: "text-xl font-bold text-gray-900 mb-3", children: "How do you measure success?" }), _jsx("p", { className: "text-gray-600", children: "We use a combination of quantitative metrics (engagement surveys, retention rates, promotion diversity) and qualitative feedback (focus groups, behavioral observations, leadership assessments) to track progress and impact." })] }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-sm", children: [_jsx("h3", { className: "text-xl font-bold text-gray-900 mb-3", children: "Can you work with remote teams?" }), _jsx("p", { className: "text-gray-600", children: "Absolutely. All our services are available virtually, in-person, or in hybrid formats. We use interactive technology and facilitation techniques that create meaningful connection regardless of format." })] }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-sm", children: [_jsx("h3", { className: "text-xl font-bold text-gray-900 mb-3", children: "What size organizations do you work with?" }), _jsx("p", { className: "text-gray-600", children: "We work with organizations of all sizes, from 20-person nonprofits to Fortune 500 companies. Our approach scales to meet your specific needs and budget." })] }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-sm", children: [_jsx("h3", { className: "text-xl font-bold text-gray-900 mb-3", children: "How quickly can we get started?" }), _jsx("p", { className: "text-gray-600", children: "After your discovery call, we can typically provide a custom proposal within 48 hours and begin work within 2-3 weeks, depending on the scope of engagement." })] })] })] }) })] }));
};
export default ServicesPage;
