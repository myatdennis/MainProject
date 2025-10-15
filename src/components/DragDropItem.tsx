import React from 'react';
import { GripVertical } from 'lucide-react';

interface DragDropItemProps {
  id: string;
  index: number;
  children: React.ReactNode;
  onReorder: (dragIndex: number, hoverIndex: number) => void;
  className?: string;
}

const DragDropItem: React.FC<DragDropItemProps> = ({
  id,
  index,
  children,
  onReorder,
  className = ''
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, index }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving this element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      const dragIndex = dragData.index;
      
      if (dragIndex !== index) {
        onReorder(dragIndex, index);
      }
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        group relative transition-all duration-200
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${dragOverIndex === index ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
        ${className}
      `}
    >
      {/* Drag Handle */}
      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing z-10">
        <div className="bg-gray-100 hover:bg-gray-200 rounded p-1 mr-2 border border-gray-200 shadow-sm">
          <GripVertical className="h-4 w-4 text-gray-600" />
        </div>
      </div>

      {/* Drop Zone Indicators */}
      {dragOverIndex === index && index > 0 && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400 transform -translate-y-1" />
      )}
      {dragOverIndex === index && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 transform translate-y-1" />
      )}

      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
};

export default DragDropItem;