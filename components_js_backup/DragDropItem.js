import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { GripVertical } from 'lucide-react';
const DragDropItem = ({ id, index, children, onReorder, className = '' }) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragOverIndex, setDragOverIndex] = React.useState(null);
    const handleDragStart = (e) => {
        setIsDragging(true);
        e.dataTransfer.setData('text/plain', JSON.stringify({ id, index }));
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragEnd = () => {
        setIsDragging(false);
        setDragOverIndex(null);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    const handleDragEnter = (e) => {
        e.preventDefault();
        setDragOverIndex(index);
    };
    const handleDragLeave = (e) => {
        // Only clear if we're actually leaving this element
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverIndex(null);
        }
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOverIndex(null);
        try {
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const dragIndex = dragData.index;
            if (dragIndex !== index) {
                onReorder(dragIndex, index);
            }
        }
        catch (error) {
            console.error('Error parsing drag data:', error);
        }
    };
    return (_jsxs("div", { draggable: true, onDragStart: handleDragStart, onDragEnd: handleDragEnd, onDragOver: handleDragOver, onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDrop: handleDrop, className: `
        group relative transition-all duration-200
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${dragOverIndex === index ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
        ${className}
      `, children: [_jsx("div", { className: "absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing z-10", children: _jsx("div", { className: "bg-gray-100 hover:bg-gray-200 rounded p-1 mr-2 border border-gray-200 shadow-sm", children: _jsx(GripVertical, { className: "h-4 w-4 text-gray-600" }) }) }), dragOverIndex === index && index > 0 && (_jsx("div", { className: "absolute top-0 left-0 right-0 h-0.5 bg-blue-400 transform -translate-y-1" })), dragOverIndex === index && (_jsx("div", { className: "absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 transform translate-y-1" })), _jsx("div", { className: "relative", children: children })] }));
};
export default DragDropItem;
