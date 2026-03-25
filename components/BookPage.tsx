import React, { useRef, useState, useEffect, useCallback } from 'react';
import { BookContent, LayoutConfig } from '../types';
import { ResizeHandle } from './ResizeHandle';

interface BookPageProps {
  content: BookContent;
  onLayoutChange: (newConfig: LayoutConfig) => void;
}

export const BookPage: React.FC<BookPageProps> = ({ content, onLayoutChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingMain, setIsDraggingMain] = useState(false);
  const [isDraggingComm, setIsDraggingComm] = useState(false);

  const layoutConfig = content.layout;

  // Check if sections have content to determine visibility
  const hasCommA = content.commentaryA.content && content.commentaryA.content.trim().length > 0;
  const hasCommB = content.commentaryB.content && content.commentaryB.content.trim().length > 0;
  
  // If only one commentary exists, it becomes full width and larger font
  const isSingleColumnBottom = (!hasCommA && hasCommB) || (hasCommA && !hasCommB);

  // Fonts based on direction
  const fontClass = content.direction === 'rtl' ? 'font-hebrew' : 'font-body';
  const headerClass = content.direction === 'rtl' ? 'font-hebrew font-bold' : 'font-header font-bold';

  // --- Handlers ---

  const handleMainResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingMain(true);
  };

  const handleCommResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingComm(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (isDraggingMain) {
      const relativeY = e.clientY - rect.top;
      const percentage = Math.min(Math.max((relativeY / rect.height) * 100, 15), 85);
      onLayoutChange({ ...layoutConfig, mainHeightPercentage: percentage });
    }

    if (isDraggingComm && hasCommA && hasCommB) {
      const relativeX = e.clientX - rect.left;
      let percentage = Math.min(Math.max((relativeX / rect.width) * 100, 15), 85);
      onLayoutChange({ ...layoutConfig, commentarySplitPercentage: percentage });
    }
  }, [isDraggingMain, isDraggingComm, layoutConfig, onLayoutChange, hasCommA, hasCommB]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingMain(false);
    setIsDraggingComm(false);
  }, []);

  useEffect(() => {
    if (isDraggingMain || isDraggingComm) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isDraggingMain ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isDraggingMain, isDraggingComm, handleMouseMove, handleMouseUp]);


  // --- Render Helpers ---

  const splitPos = layoutConfig.commentarySplitPercentage;

  const renderSectionContent = (label: string, text: string, isMain = false, isFullHeight = true, isSingleCol = false) => {
    // Dynamic text sizing
    let textSizeClass = "text-sm leading-relaxed";
    if (isMain) textSizeClass = "text-xl leading-loose";
    else if (isSingleCol) textSizeClass = "text-lg leading-loose"; // Larger text for single column notes

    return (
      <div className={`${isFullHeight ? 'h-full' : 'h-auto'} ${isMain ? 'p-8 md:p-10' : 'p-4 md:p-6 pb-2'}`}>
        <h3 className={`text-stone-500 mb-2 border-b border-stone-300 pb-1 ${isMain ? 'text-2xl text-center mb-6' : 'text-sm font-bold uppercase tracking-wider'} ${headerClass}`}>
          {label}
        </h3>
        <div 
          className={`${textSizeClass} text-stone-900 text-justify hyphens-auto ${fontClass}`}
          dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, isMain ? '<br/>' : '<br/><br/>') }}
        />
      </div>
    );
  };

  return (
    <div 
      className="bg-white shadow-2xl overflow-hidden relative border border-stone-200 flex flex-col"
      style={{ 
        aspectRatio: '8.5 / 11', // STRICT 8.5x11 Ratio
        width: '100%',
        maxWidth: '100%',
        height: 'auto'
      }} 
      ref={containerRef}
      dir={content.direction}
    >
      {/* Header */}
      <header className="h-[5%] border-b-2 border-double border-stone-300 flex items-center justify-between px-8 bg-stone-50 shrink-0 z-20">
        <span className={`text-stone-500 text-xs ${headerClass}`}>{content.title}</span>
        <span className="font-header font-bold text-stone-800 bg-stone-200 px-2 py-0.5 rounded text-[10px] tracking-widest">{content.pageNumber}</span>
      </header>

      {/* --- Main Text Section (Always Top) --- */}
      <div 
        className="relative overflow-hidden bg-white shrink-0"
        style={{ height: `${layoutConfig.mainHeightPercentage}%` }}
      >
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
           {renderSectionContent(content.mainText.label, content.mainText.content, true, true)}
        </div>
      </div>

      {/* Main Resize Handle */}
      <ResizeHandle orientation="horizontal" onMouseDown={handleMainResizeStart} />

      {/* --- Bottom Section (Commentaries) --- */}
      <div className="flex-1 relative min-h-0 bg-stone-50/30 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2">
            
            {/* SCENARIO 1: SINGLE COLUMN (Only A or Only B) */}
            {isSingleColumnBottom && (
              <div className="h-full">
                {hasCommA 
                  ? renderSectionContent(content.commentaryA.label, content.commentaryA.content, false, true, true)
                  : renderSectionContent(content.commentaryB.label, content.commentaryB.content, false, true, true)
                }
              </div>
            )}

            {/* SCENARIO 2: BOTH EXIST - Render layout based on config */}
            {!isSingleColumnBottom && hasCommA && hasCommB && (
              <>
                {layoutConfig.mode === 'columns' && (
                  <div className="flex min-h-full items-stretch">
                      <div style={{ width: `${content.direction === 'ltr' ? splitPos : 100 - splitPos}%` }} className="relative shrink-0">
                        {renderSectionContent(content.commentaryA.label, content.commentaryA.content, false, true)}
                      </div>
                      <div 
                        className="w-4 -ml-2 z-10 cursor-col-resize flex justify-center hover:bg-stone-200/50 transition-colors rounded"
                        onMouseDown={handleCommResizeStart}
                      >
                        <div className="w-px h-full bg-stone-300"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {renderSectionContent(content.commentaryB.label, content.commentaryB.content, false, true)}
                      </div>
                  </div>
                )}

                {layoutConfig.mode !== 'columns' && (
                  <div className="relative block">
                    <div 
                      style={{ 
                        float: layoutConfig.mode === 'wrap-a' 
                            ? (content.direction === 'rtl' ? 'right' : 'left') 
                            : (content.direction === 'rtl' ? 'left' : 'right'),
                        width: `${layoutConfig.mode === 'wrap-a' 
                            ? (content.direction === 'rtl' ? 100 - splitPos : splitPos) 
                            : (content.direction === 'rtl' ? splitPos : 100 - splitPos)}%`,
                      }}
                      className={`
                        relative 
                        mb-2
                        ${layoutConfig.mode === 'wrap-a' 
                            ? (content.direction === 'rtl' ? 'pl-4 ml-2 border-l' : 'pr-4 mr-2 border-r') 
                            : (content.direction === 'rtl' ? 'pr-4 mr-2 border-r' : 'pl-4 ml-2 border-l')}
                        border-stone-300
                      `}
                    >
                        {renderSectionContent(
                            layoutConfig.mode === 'wrap-a' ? content.commentaryA.label : content.commentaryB.label, 
                            layoutConfig.mode === 'wrap-a' ? content.commentaryA.content : content.commentaryB.content,
                            false,
                            false
                        )}
                        <div 
                            className={`absolute top-0 bottom-0 w-6 cursor-col-resize group flex items-start justify-center z-20 pt-10
                              ${layoutConfig.mode === 'wrap-a' 
                                ? (content.direction === 'rtl' ? '-left-3' : '-right-3')
                                : (content.direction === 'rtl' ? '-right-3' : '-left-3')
                              }
                            `}
                            onMouseDown={handleCommResizeStart}
                        >
                            <div className="w-1.5 h-12 bg-stone-300/50 rounded-full group-hover:bg-amber-500 transition-colors shadow-sm ring-1 ring-white"></div>
                        </div>
                    </div>

                    <div className="text-justify relative">
                        {renderSectionContent(
                            layoutConfig.mode === 'wrap-a' ? content.commentaryB.label : content.commentaryA.label, 
                            layoutConfig.mode === 'wrap-a' ? content.commentaryB.content : content.commentaryA.content,
                            false,
                            false
                        )}
                    </div>
                    <div className="clear-both"></div>
                  </div>
                )}
              </>
            )}

             {/* SCENARIO 3: BOTH EMPTY */}
             {!hasCommA && !hasCommB && (
               <div className="h-full flex items-center justify-center text-stone-300 italic">
                 No Commentary
               </div>
             )}

        </div>
      </div>
      
      <div className="h-[2%] bg-stone-100 border-t border-stone-200 shrink-0 flex items-center justify-center">
         <div className="w-1/3 h-px bg-stone-300"></div>
      </div>
    </div>
  );
};