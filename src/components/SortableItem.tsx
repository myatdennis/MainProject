import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

interface SortableItemRenderProps {
  attributes: DraggableAttributes;
  listeners?: SyntheticListenerMap;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  isDragging: boolean;
}

interface SortableItemProps {
  id: string;
  disabled?: boolean;
  className?: string;
  children: (props: SortableItemRenderProps) => ReactNode;
}

const SortableItem = ({ id, disabled, className = '', children }: SortableItemProps) => {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${isDragging ? 'z-30 scale-[0.99] shadow-xl ring-2 ring-orange-200' : ''}`}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
};

export type { SortableItemRenderProps };
export default SortableItem;
