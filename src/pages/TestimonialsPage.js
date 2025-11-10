import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { Star, Quote, CheckCircle, Heart, Users, TrendingUp } from 'lucide-react';
const TestimonialsPage = () => {
    const navigate = useNavigate();
    const testimonials = [
        {
            name: "Dr. Sarah Chen",
            title: "Vice President of Student Affairs",
            organization: "Pacific Coast University",
            image: "https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=400",
            quote: "Mya's inclusive leadership workshop transformed how our administrative team approaches student support. We saw a 40% increase in student engagement within three months.",
            rating: 5,
            results: ["40% increase in student engagement", "Reduced administrative conflicts by 60%", "Improved cross-department collaboration"]
        },
        {
            name: "Marcus Rodriguez",
            title: "Athletic Director",
            organization: "Mountain View High School",
            image: "https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=400",
            quote: "The courageous conversations training gave our coaching staff the tools to address sensitive issues with confidence. Our team culture has never been stronger.",
            rating: 5,
            results: ["Eliminated hazing incidents", "Increased athlete retention by 25%", "Improved parent-coach relationships"]
        },
        {
            name: "Jennifer Walsh",
            title: "Executive Director",
            organization: "Community Impact Network",
            image: "https://images.pexels.com/photos/3184394/pexels-photo-3184394.jpeg?auto=compress&cs=tinysrgb&w=400",
            quote: "Our strategic DEI planning engagement with The Huddle Co. resulted in concrete changes that our entire organization can feel. The process was thorough and transformative.",
            rating: 5,
            results: ["Developed 3-year DEI strategic plan", "Increased diverse hiring by 35%", "Launched employee resource groups"]
        },
        {
            name: "Captain David Thompson",
            title: "Training Commander",
            organization: "Regional Fire Department",
            image: "https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=400",
            quote: "Mya helped us navigate some very challenging conversations about culture change. Her approach is both compassionate and direct - exactly what we needed.",
            rating: 5,
            results: ["Reduced workplace complaints by 70%", "Improved recruitment diversity", "Enhanced team communication"]
        },
        {
            name: "Lisa Park",
            title: "Chief Human Resources Officer",
            organization: "TechForward Solutions",
            image: "https://images.pexels.com/photos/3184317/pexels-photo-3184317.jpeg?auto=compress&cs=tinysrgb&w=400",
            quote: "The Huddle Co.'s leadership development program gave our managers practical tools they use daily. Employee satisfaction scores reached an all-time high.",
            rating: 5,
            results: ["Employee satisfaction up 45%", "Manager confidence increased significantly", "Reduced turnover by 30%"]
        },
        {
            name: "Rev. Michael Johnson",
            title: "Senior Pastor",
            organization: "Unity Community Church",
            image: "https://images.pexels.com/photos/3184420/pexels-photo-3184420.jpeg?auto=compress&cs=tinysrgb&w=400",
            quote: "Working with Mya helped us create a more welcoming environment for all families. Her guidance through sensitive conversations was invaluable.",
            rating: 5,
            results: ["Increased congregational diversity", "Launched inclusive ministry programs", "Improved community partnerships"]
        }
    ];
    const caseStudies = [
        {
            organization: "Regional Medical Center",
            challenge: "High turnover among diverse nursing staff and communication barriers between departments.",
            solution: "6-month inclusive leadership program with monthly workshops and coaching for department heads.",
            results: [
                "Reduced nursing turnover from 32% to 18%",
                "Improved patient satisfaction scores by 23%",
                "Decreased interdepartmental conflicts by 55%",
                "Launched mentorship program for new hires"
            ],
            testimonial: "The transformation in our workplace culture has been remarkable. Staff feel heard and valued in ways they never have before."
        },
        {
            organization: "State Government Agency",
            challenge: "Outdated policies and resistance to DEI initiatives at the management level.",
            solution: "Strategic DEI planning with executive coaching and policy review across 18 months.",
            results: [
                "Revised 47 policies for inclusive language",
                "Increased leadership diversity by 40%",
                "Implemented bias training for 1,200+ employees",
                "Created accountability metrics and tracking systems"
            ],
            testimonial: "Mya helped us move from compliance-focused thinking to genuine culture change. The results speak for themselves."
        }
    ];
    const stats = [
        { number: "98%", label: "Client Satisfaction Rate" },
        { number: "150+", label: "Organizations Served" },
        { number: "500+", label: "Leaders Trained" },
        { number: "85%", label: "Report Lasting Change" }
    ];
    return (_jsxs("div", { children: [_jsx("section", { className: "bg-gradient-to-br from-blue-50 to-green-50 py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center", children: [_jsx("h1", { className: "text-4xl md:text-5xl font-bold text-gray-900 mb-6", children: "Real Stories, Real Results" }), _jsx("p", { className: "text-xl text-gray-600 mb-12 max-w-3xl mx-auto", children: "See how organizations across industries have transformed their cultures and achieved measurable improvements through our DEI programs." }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-8", children: stats.map((stat, index) => (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm", children: [_jsx("div", { className: "text-3xl md:text-4xl font-bold text-orange-500 mb-2", children: stat.number }), _jsx("div", { className: "text-gray-600", children: stat.label })] }, index))) })] }) }), _jsx("section", { className: "py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-16", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold text-gray-900 mb-6", children: "What Our Clients Say" }), _jsx("p", { className: "text-xl text-gray-600 max-w-3xl mx-auto", children: "Leaders across universities, sports organizations, nonprofits, government agencies, and corporations share their transformation stories." })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8", children: testimonials.map((testimonial, index) => (_jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200", children: [_jsxs("div", { className: "flex items-center mb-6", children: [_jsx("img", { src: testimonial.image, alt: testimonial.name, className: "w-16 h-16 rounded-full object-cover mr-4" }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-gray-900", children: testimonial.name }), _jsx("p", { className: "text-sm text-gray-600", children: testimonial.title }), _jsx("p", { className: "text-sm text-orange-500 font-medium", children: testimonial.organization })] })] }), _jsx("div", { className: "flex mb-4", children: [...Array(testimonial.rating)].map((_, i) => (_jsx(Star, { className: "h-5 w-5 text-yellow-400 fill-current" }, i))) }), _jsxs("div", { className: "relative mb-6", children: [_jsx(Quote, { className: "h-8 w-8 text-orange-200 absolute -top-2 -left-1" }), _jsx("p", { className: "text-gray-700 pl-6 italic", children: testimonial.quote })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "font-semibold text-gray-900 text-sm", children: "Key Results:" }), testimonial.results.map((result, resultIndex) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "h-4 w-4 text-green-500 flex-shrink-0" }), _jsx("span", { className: "text-sm text-gray-600", children: result })] }, resultIndex)))] })] }, index))) })] }) }), _jsx("section", { className: "bg-gray-50 py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-16", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold text-gray-900 mb-6", children: "In-Depth Case Studies" }), _jsx("p", { className: "text-xl text-gray-600 max-w-3xl mx-auto", children: "Detailed looks at how our strategic partnerships created lasting organizational change." })] }), _jsx("div", { className: "space-y-12", children: caseStudies.map((study, index) => (_jsx("div", { className: "bg-white rounded-2xl shadow-lg overflow-hidden", children: _jsxs("div", { className: "p-8 lg:p-12", children: [_jsx("h3", { className: "text-2xl font-bold text-gray-900 mb-6", children: study.organization }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center mb-3", children: [_jsx(Heart, { className: "h-6 w-6 text-red-500 mr-2" }), _jsx("h4", { className: "font-semibold text-gray-900", children: "Challenge" })] }), _jsx("p", { className: "text-gray-600", children: study.challenge })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center mb-3", children: [_jsx(Users, { className: "h-6 w-6 text-blue-500 mr-2" }), _jsx("h4", { className: "font-semibold text-gray-900", children: "Our Solution" })] }), _jsx("p", { className: "text-gray-600", children: study.solution })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center mb-3", children: [_jsx(TrendingUp, { className: "h-6 w-6 text-green-500 mr-2" }), _jsx("h4", { className: "font-semibold text-gray-900", children: "Results" })] }), _jsx("ul", { className: "space-y-2", children: study.results.map((result, resultIndex) => (_jsxs("li", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "h-4 w-4 text-green-500 flex-shrink-0" }), _jsx("span", { className: "text-sm text-gray-600", children: result })] }, resultIndex))) })] })] }), _jsxs("div", { className: "mt-8 p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg", children: [_jsx(Quote, { className: "h-6 w-6 text-orange-400 mb-2" }), _jsx("p", { className: "text-gray-700 italic", children: study.testimonial })] })] }) }, index))) })] }) }), _jsx("section", { className: "py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-16", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold text-gray-900 mb-6", children: "See the Impact in Action" }), _jsx("p", { className: "text-xl text-gray-600 max-w-3xl mx-auto", children: "Watch how leaders describe their transformation experience with The Huddle Co." })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8", children: [_jsxs("div", { className: "bg-white rounded-2xl shadow-lg overflow-hidden", children: [_jsx("div", { className: "aspect-video bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "bg-white rounded-full p-4 mb-4 mx-auto w-16 h-16 flex items-center justify-center", children: _jsx("svg", { className: "w-8 h-8 text-blue-500", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { d: "M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" }) }) }), _jsx("p", { className: "font-semibold text-gray-700", children: "University Leadership Team" }), _jsx("p", { className: "text-sm text-gray-500", children: "3:24 minutes" })] }) }), _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "font-bold text-lg text-gray-900 mb-2", children: "Transforming Campus Culture" }), _jsx("p", { className: "text-gray-600", children: "How one university's leadership team created a more inclusive environment for all students and staff." })] })] }), _jsxs("div", { className: "bg-white rounded-2xl shadow-lg overflow-hidden", children: [_jsx("div", { className: "aspect-video bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "bg-white rounded-full p-4 mb-4 mx-auto w-16 h-16 flex items-center justify-center", children: _jsx("svg", { className: "w-8 h-8 text-orange-500", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { d: "M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" }) }) }), _jsx("p", { className: "font-semibold text-gray-700", children: "Sports Organization" }), _jsx("p", { className: "text-sm text-gray-500", children: "2:47 minutes" })] }) }), _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "font-bold text-lg text-gray-900 mb-2", children: "Building Team Unity" }), _jsx("p", { className: "text-gray-600", children: "A athletic director shares how courageous conversations training strengthened team bonds and performance." })] })] })] })] }) }), _jsx("section", { className: "bg-gradient-to-r from-blue-500 to-green-500 py-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold text-white mb-6", children: "Ready to Create Your Success Story?" }), _jsx("p", { className: "text-xl text-blue-100 mb-8 max-w-2xl mx-auto", children: "Join the leaders who have transformed their organizations with The Huddle Co. Let's discuss how we can help you achieve similar results." }), _jsx("button", { onClick: () => navigate('/contact'), className: "bg-white text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200", children: "Start Your Transformation" })] }) })] }));
};
export default TestimonialsPage;
