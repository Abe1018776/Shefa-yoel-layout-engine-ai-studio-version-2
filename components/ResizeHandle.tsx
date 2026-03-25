import React from 'react';

interface ResizeHandleProps {
  orientation: 'horizontal' | 'vertical';
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ orientation, onMouseDown, className = '' }) => {
  const baseClasses = "flex items-center justify-center bg-stone-200 hover:bg-stone-400 transition-colors z-10 group touch-none select-none";
  const sizeClasses = orientation === 'horizontal' 
    ? "h-3 w-full cursor-row-resize border-y border-stone-300" 
    : "w-3 h-full cursor-col-resize border-x border-stone-300";
    
  return (
    <div 
      className={`${baseClasses} ${sizeClasses} ${className}`} 
      onMouseDown={onMouseDown}
    >
      <div className={`bg-stone-400 group-hover:bg-stone-600 rounded-full ${orientation === 'horizontal' ? 'w-8 h-1' : 'w-1 h-8'}`} />
    </div>
  );
};