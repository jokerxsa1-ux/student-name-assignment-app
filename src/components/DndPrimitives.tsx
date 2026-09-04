import type { CSSProperties, ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import styles from '../styles/App.module.css';

export function DraggableName({ id, children, disabled = false }: { id: string; children: ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.45 : 1 };
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={styles.draggableName}
      {...listeners}
      {...attributes}
    >{children}</button>
  );
}

export function DroppableArea({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? styles.dropTarget : ''}`}>{children}</div>
  );
}
