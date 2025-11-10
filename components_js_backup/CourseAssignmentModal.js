import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, BookOpen, Users } from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
const CourseAssignmentModal = ({ isOpen, onClose, selectedUsers, course: _course, onAssignComplete }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const courses = [
        { id: '1', title: 'Foundations of Inclusive Leadership', duration: '4 weeks' },
        { id: '2', title: 'Recognizing and Mitigating Bias', duration: '3 weeks' },
        { id: '3', title: 'Empathy in Action', duration: '3 weeks' },
        { id: '4', title: 'Courageous Conversations at Work', duration: '5 weeks' },
        { id: '5', title: 'Personal & Team Action Planning', duration: '2 weeks' }
    ];
    if (!isOpen)
        return null;
    const handleAssign = async (e) => {
        e.preventDefault();
        if (!selectedCourse) {
            showToast('Please select a course to assign', 'error');
            return;
        }
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            const courseName = courses.find(c => c.id === selectedCourse)?.title;
            showToast(`${courseName} assigned to ${selectedUsers.length} user(s)`, 'success');
            onAssignComplete?.();
            onClose();
        }
        catch (error) {
            showToast('Failed to assign course', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-xl shadow-xl max-w-md w-full mx-4", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-green-100 p-2 rounded-lg", children: _jsx(BookOpen, { className: "h-6 w-6 text-green-600" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Assign Course" }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Assign course to ", selectedUsers.length, " user(s)"] })] })] }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-400 hover:text-gray-600 rounded-lg", disabled: loading, children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("form", { onSubmit: handleAssign, className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Course *" }), _jsxs("select", { value: selectedCourse, onChange: (e) => setSelectedCourse(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent", required: true, disabled: loading, children: [_jsx("option", { value: "", children: "Choose a course..." }), courses.map(course => (_jsxs("option", { value: course.id, children: [course.title, " (", course.duration, ")"] }, course.id)))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Assignment Date" }), _jsx("input", { type: "date", value: assignmentDate, onChange: (e) => setAssignmentDate(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent", disabled: loading })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Due Date (Optional)" }), _jsx("input", { type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value), min: assignmentDate, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent", disabled: loading })] })] }), _jsx("div", { className: "bg-blue-50 p-4 rounded-lg", children: _jsxs("div", { className: "flex items-start space-x-2", children: [_jsx(Users, { className: "h-5 w-5 text-blue-600 mt-0.5" }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-blue-900", children: "Assignment Details" }), _jsx("p", { className: "text-sm text-blue-700 mt-1", children: "Selected users will receive email notifications about their course assignment and can begin immediately." })] })] }) }), _jsxs("div", { className: "flex items-center justify-end space-x-4 pt-6 border-t border-gray-200", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200", disabled: loading, children: "Cancel" }), _jsxs(LoadingButton, { type: "submit", loading: loading, variant: "success", children: [_jsx(BookOpen, { className: "h-4 w-4" }), "Assign Course"] })] })] })] }) }));
};
export default CourseAssignmentModal;
