import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Calendar, Clock, User, MessageSquare, X, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
const BookingWidget = ({ isOpen, onClose }) => {
    const { showToast } = useToast();
    const [step, setStep] = useState('info');
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        role: '',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        preferredDate: '',
        preferredTime: '',
        sessionType: 'discovery',
        message: ''
    });
    const sessionTypes = [
        {
            id: 'discovery',
            title: 'Discovery Call',
            duration: '30 minutes',
            description: 'Learn about our services and discuss your DEI goals',
            popular: true
        },
        {
            id: 'strategy',
            title: 'Strategy Session',
            duration: '60 minutes',
            description: 'Deep dive into your specific challenges and create an action plan'
        },
        {
            id: 'consultation',
            title: 'Leadership Consultation',
            duration: '45 minutes',
            description: 'Executive-level discussion on organizational transformation'
        }
    ];
    const timeSlots = [
        { time: '09:00 AM', available: true },
        { time: '10:00 AM', available: true },
        { time: '11:00 AM', available: false },
        { time: '01:00 PM', available: true },
        { time: '02:00 PM', available: true },
        { time: '03:00 PM', available: true },
        { time: '04:00 PM', available: false },
        { time: '05:00 PM', available: true }
    ];
    const timeZones = [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo'
    ];
    // Get next 14 days for date selection
    const availableDates = Array.from({ length: 14 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i + 1); // Start from tomorrow
        return {
            value: date.toISOString().split('T')[0],
            label: date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            }),
            disabled: date.getDay() === 0 || date.getDay() === 6 // Disable weekends
        };
    });
    const updateForm = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };
    const validateStep = () => {
        if (step === 'info') {
            return form.firstName && form.lastName && form.email && form.company;
        }
        if (step === 'scheduling') {
            return form.preferredDate && form.preferredTime && form.sessionType;
        }
        return true;
    };
    const handleNext = () => {
        if (!validateStep()) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        if (step === 'info') {
            setStep('scheduling');
        }
        else if (step === 'scheduling') {
            submitBooking();
        }
    };
    const submitBooking = async () => {
        setLoading(true);
        try {
            // Mock API call - replace with actual booking service
            await new Promise(resolve => setTimeout(resolve, 2000));
            setStep('confirmation');
            showToast('Your discovery call has been scheduled!', 'success');
        }
        catch (error) {
            showToast('Failed to schedule call. Please try again.', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleClose = () => {
        setForm({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            company: '',
            role: '',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            preferredDate: '',
            preferredTime: '',
            sessionType: 'discovery',
            message: ''
        });
        setStep('info');
        onClose();
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 overflow-y-auto", children: _jsxs("div", { className: "flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0", children: [_jsx("div", { className: "fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75", onClick: handleClose }), _jsxs("div", { className: "inline-block w-full max-w-2xl px-6 py-4 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between pb-4 border-b border-gray-200", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: step === 'confirmation' ? 'Booking Confirmed!' : 'Schedule Your Discovery Call' }), _jsxs("p", { className: "text-sm text-gray-500", children: [step === 'info' && 'Tell us about yourself and your organization', step === 'scheduling' && 'Choose your preferred date and time', step === 'confirmation' && 'We\'re excited to connect with you'] })] }), _jsx("button", { onClick: handleClose, className: "text-gray-400 hover:text-gray-600", children: _jsx(X, { className: "h-5 w-5" }) })] }), step !== 'confirmation' && (_jsx("div", { className: "flex items-center justify-center py-4", children: _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: `flex items-center justify-center w-8 h-8 rounded-full ${step === 'info' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-500'}`, children: step === 'scheduling' ? _jsx(Check, { className: "h-4 w-4" }) : '1' }), _jsx("div", { className: `h-1 w-16 ${step === 'scheduling' ? 'bg-orange-500' : 'bg-gray-200'}` }), _jsx("div", { className: `flex items-center justify-center w-8 h-8 rounded-full ${step === 'scheduling' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`, children: "2" })] }) })), step === 'info' && (_jsxs("div", { className: "py-6 space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-3", children: "What type of session would you like?" }), _jsx("div", { className: "space-y-3", children: sessionTypes.map(session => (_jsxs("label", { className: `relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${form.sessionType === session.id
                                                    ? 'border-orange-500 bg-orange-50'
                                                    : 'border-gray-200 hover:bg-gray-50'}`, children: [_jsx("input", { type: "radio", name: "sessionType", value: session.id, checked: form.sessionType === session.id, onChange: (e) => updateForm('sessionType', e.target.value), className: "sr-only" }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium text-gray-900", children: session.title }), session.popular && (_jsx("span", { className: "bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded", children: "Popular" }))] }), _jsxs("div", { className: "mt-1 text-sm text-gray-500", children: [session.duration, " \u2022 ", session.description] })] })] }, session.id))) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "First Name *" }), _jsx("input", { type: "text", value: form.firstName, onChange: (e) => updateForm('firstName', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Last Name *" }), _jsx("input", { type: "text", value: form.lastName, onChange: (e) => updateForm('lastName', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", required: true })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Email Address *" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => updateForm('email', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Phone Number" }), _jsx("input", { type: "tel", value: form.phone, onChange: (e) => updateForm('phone', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Company/Organization *" }), _jsx("input", { type: "text", value: form.company, onChange: (e) => updateForm('company', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Your Role" }), _jsx("input", { type: "text", value: form.role, onChange: (e) => updateForm('role', e.target.value), placeholder: "e.g., HR Director, CEO, Manager", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "What would you like to discuss? (Optional)" }), _jsx("textarea", { value: form.message, onChange: (e) => updateForm('message', e.target.value), rows: 3, placeholder: "Tell us about your DEI goals, challenges, or specific questions...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })), step === 'scheduling' && (_jsxs("div", { className: "py-6 space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Time Zone" }), _jsx("select", { value: form.timeZone, onChange: (e) => updateForm('timeZone', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: timeZones.map(tz => (_jsx("option", { value: tz, children: tz }, tz))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-3", children: "Preferred Date" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-2", children: availableDates.map(date => (_jsx("button", { onClick: () => updateForm('preferredDate', date.value), disabled: date.disabled, className: `p-3 text-sm rounded-lg border ${date.disabled
                                                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                                                    : form.preferredDate === date.value
                                                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'}`, children: date.label }, date.value))) })] }), form.preferredDate && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-3", children: "Preferred Time" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-2", children: timeSlots.map(slot => (_jsx("button", { onClick: () => updateForm('preferredTime', slot.time), disabled: !slot.available, className: `p-3 text-sm rounded-lg border ${!slot.available
                                                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                                                    : form.preferredTime === slot.time
                                                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'}`, children: slot.time }, slot.time))) })] })), form.preferredDate && form.preferredTime && (_jsxs("div", { className: "bg-gray-50 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Session Summary" }), _jsxs("div", { className: "space-y-1 text-sm text-gray-600", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(User, { className: "h-4 w-4 mr-2" }), sessionTypes.find(s => s.id === form.sessionType)?.title, "(", sessionTypes.find(s => s.id === form.sessionType)?.duration, ")"] }), _jsxs("div", { className: "flex items-center", children: [_jsx(Calendar, { className: "h-4 w-4 mr-2" }), new Date(form.preferredDate).toLocaleDateString('en-US', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })] }), _jsxs("div", { className: "flex items-center", children: [_jsx(Clock, { className: "h-4 w-4 mr-2" }), form.preferredTime, " (", form.timeZone, ")"] })] })] }))] })), step === 'confirmation' && (_jsxs("div", { className: "py-6 text-center", children: [_jsx("div", { className: "mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4", children: _jsx(Check, { className: "h-6 w-6 text-green-600" }) }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "Your call is confirmed!" }), _jsx("div", { className: "bg-gray-50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto", children: _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Session:" }), _jsx("span", { className: "font-medium", children: sessionTypes.find(s => s.id === form.sessionType)?.title })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Date:" }), _jsx("span", { className: "font-medium", children: new Date(form.preferredDate).toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        }) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Time:" }), _jsx("span", { className: "font-medium", children: form.preferredTime })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Duration:" }), _jsx("span", { className: "font-medium", children: sessionTypes.find(s => s.id === form.sessionType)?.duration })] })] }) }), _jsxs("p", { className: "text-gray-600 mb-4", children: ["We've sent a calendar invitation to ", _jsx("strong", { children: form.email }), " with the meeting details."] }), _jsxs("div", { className: "flex items-center justify-center space-x-2 text-sm text-gray-500 mb-6", children: [_jsx(MessageSquare, { className: "h-4 w-4" }), _jsx("span", { children: "You'll receive a confirmation email with preparation materials shortly." })] })] })), _jsx("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: step === 'confirmation' ? (_jsx("div", { className: "flex w-full justify-center", children: _jsx("button", { onClick: handleClose, className: "px-6 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700", children: "Close" }) })) : (_jsxs(_Fragment, { children: [step === 'scheduling' && (_jsx("button", { onClick: () => setStep('info'), className: "px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200", children: "Back" })), _jsxs("div", { className: "flex space-x-3 ml-auto", children: [_jsx("button", { onClick: handleClose, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200", children: "Cancel" }), _jsx("button", { onClick: handleNext, disabled: !validateStep() || loading, className: "px-6 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Scheduling...' : step === 'info' ? 'Next' : 'Schedule Call' })] })] })) })] })] }) }));
};
export default BookingWidget;
