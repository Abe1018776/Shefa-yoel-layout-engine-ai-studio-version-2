import React, { useRef, useState } from 'react';
import { BookContent, LayoutConfig, LayoutMode, SectionType } from '../types';
import { paginateBook } from '../services/geminiService';
import { parseWordFile } from '../services/wordParser';

interface EditorPanelProps {
  content: BookContent;
  onLayoutConfigChange: (config: LayoutConfig) => void;
  activeSection: SectionType;
  onContentChange: (newContent: BookContent) => void;
  onSectionSelect: (section: SectionType) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onBookLoaded?: (pages: BookContent[]) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ 
  content, 
  onLayoutConfigChange,
  activeSection, 
  onContentChange, 
  onSectionSelect,
  isGenerating,
  onGenerate,
  onBookLoaded
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const layoutConfig = content.layout;

  const handleTextChange = (value: string, field: 'mainText' | 'commentaryA' | 'commentaryB') => {
    onContentChange({
      ...content,
      [field]: {
        ...content[field],
        content: value
      }
    });
  };

  const handleTitleChange = (value: string) => {
    onContentChange({ ...content, title: value });
  };

  const getActiveContent = () => {
    switch(activeSection) {
      case SectionType.MAIN: return content.mainText;
      case SectionType.COMM_A: return content.commentaryA;
      case SectionType.COMM_B: return content.commentaryB;
    }
  };

  const activeData = getActiveContent();

  const handleModeChange = (mode: LayoutMode) => {
    onLayoutConfigChange({ ...layoutConfig, mode });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const processFile = async () => {
      try {
        let processedData: any = null;

        if (file.name.endsWith('.docx')) {
           // Parse Word File
           processedData = await parseWordFile(file);
        } else if (file.name.endsWith('.json')) {
           // Parse JSON
           const text = await file.text();
           processedData = JSON.parse(text);
        } else {
           throw new Error("Unsupported file type");
        }

        // Send to Gemini for Pagination Planning
        const pages = await paginateBook(processedData);
        
        if (pages && pages.length > 0 && onBookLoaded) {
            onBookLoaded(pages);
        } else {
            alert("Failed to paginate book content. Please try again.");
        }
      } catch (err) {
        console.error("Error processing file", err);
        alert("Error processing file: " + (err as Error).message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    processFile();
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-xl z-20">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".json,.docx"
      />
      
      {/* Toolbar */}
      <div className="p-4 border-b border-stone-200 bg-stone-50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="font-header font-bold text-xl text-stone-800">TriScriptor</h1>
          <button 
              onClick={() => onContentChange({...content, direction: content.direction === 'rtl' ? 'ltr' : 'rtl'})}
              className="px-2 py-1 text-xs font-bold border border-stone-300 rounded hover:bg-stone-200 text-stone-600 uppercase"
            >
              {content.direction}
          </button>
        </div>

        {/* Layout Mode Toggles */}
        <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-stone-400">Anchor Strategy (This Page)</span>
            <div className="flex p-1 bg-stone-200 rounded-lg shadow-inner gap-0.5">
            <button 
                onClick={() => handleModeChange('columns')}
                className={`flex-1 py-2 px-1 text-[10px] leading-tight font-bold rounded transition-all ${layoutConfig.mode === 'columns' ? 'bg-white text-stone-800 shadow-sm ring-1 ring-stone-300' : 'text-stone-500 hover:text-stone-700'}`}
                title="Strict Columns"
            >
                Columns<br/>||
            </button>
            <button 
                onClick={() => handleModeChange('wrap-a')}
                className={`flex-1 py-2 px-1 text-[10px] leading-tight font-bold rounded transition-all ${layoutConfig.mode === 'wrap-a' ? 'bg-white text-stone-800 shadow-sm ring-1 ring-stone-300' : 'text-stone-500 hover:text-stone-700'}`}
                title="Commentary B flows under Commentary A"
            >
                {content.direction === 'rtl' ? 'Right' : 'Left'} Fixed<br/>
                {content.direction === 'rtl' ? '⅂' : 'L'} Shape
            </button>
            <button 
                onClick={() => handleModeChange('wrap-b')}
                className={`flex-1 py-2 px-1 text-[10px] leading-tight font-bold rounded transition-all ${layoutConfig.mode === 'wrap-b' ? 'bg-white text-stone-800 shadow-sm ring-1 ring-stone-300' : 'text-stone-500 hover:text-stone-700'}`}
                title="Commentary A flows under Commentary B"
            >
                {content.direction === 'rtl' ? 'Left' : 'Right'} Fixed<br/>
                {content.direction === 'rtl' ? 'L' : '⅂'} Shape
            </button>
        </div>
        </div>

        <div className="flex gap-2 mt-1">
           <input 
             type="text" 
             value={content.title}
             onChange={(e) => handleTitleChange(e.target.value)}
             className="flex-1 px-3 py-1.5 text-sm border border-stone-300 rounded focus:ring-2 focus:ring-amber-500 outline-none font-header"
             placeholder="Book Title"
           />
           <button
            onClick={triggerUpload}
            disabled={isUploading}
            className={`px-3 py-1.5 text-xs font-bold text-stone-700 bg-stone-200 hover:bg-stone-300 rounded shadow-sm flex items-center gap-2 transition-all border border-stone-300 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
           >
             {isUploading ? 'Planning...' : 'Upload Docx/JSON'}
           </button>
           <button
            onClick={onGenerate}
            disabled={isGenerating}
            className={`px-3 py-1.5 text-xs font-bold text-white rounded shadow-sm flex items-center gap-2 transition-all
              ${isGenerating ? 'bg-stone-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'}
            `}
           >
             {isGenerating ? 'Thinking...' : 'AI Fill'}
           </button>
        </div>
      </div>

      {/* Domain Selectors (Tabs) */}
      <div className="flex border-b border-stone-200 bg-stone-100">
        {[
          { id: SectionType.MAIN, label: 'Main' },
          { id: SectionType.COMM_A, label: 'Comm. A' },
          { id: SectionType.COMM_B, label: 'Comm. B' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSectionSelect(tab.id)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeSection === tab.id 
                ? 'border-amber-600 text-amber-700 bg-white' 
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Domain Editor */}
      <div className="flex-1 flex flex-col p-4 bg-white overflow-hidden">
        
        <div className="flex items-center gap-2 mb-4 bg-stone-50 p-2 rounded border border-stone-100">
           <span className="text-xs text-stone-400 uppercase font-bold tracking-wider w-16">Header</span>
           <input 
              type="text"
              value={activeData.label}
              onChange={(e) => {
                const field = activeSection === SectionType.MAIN ? 'mainText' : activeSection === SectionType.COMM_A ? 'commentaryA' : 'commentaryB';
                onContentChange({
                  ...content,
                  [field]: { ...activeData, label: e.target.value }
                });
              }}
              className="flex-1 border-b border-stone-300 py-1 text-sm focus:border-amber-500 outline-none bg-transparent font-bold text-stone-700"
           />
        </div>

        <textarea
          value={activeData.content}
          onChange={(e) => {
             const field = activeSection === SectionType.MAIN ? 'mainText' : activeSection === SectionType.COMM_A ? 'commentaryA' : 'commentaryB';
             handleTextChange(e.target.value, field);
          }}
          dir={content.direction}
          className="flex-1 w-full resize-none outline-none border border-stone-200 rounded p-4 text-stone-700 leading-relaxed focus:ring-2 focus:ring-amber-100 focus:border-amber-300 font-serif text-base custom-scrollbar"
          placeholder="Start typing specific domain content here..."
        />
        
        <div className="mt-2 text-xs text-stone-400 flex justify-between">
          <span>{activeData.content.length} chars</span>
          <span>{activeData.content.split(/\s+/).filter(Boolean).length} words</span>
        </div>
      </div>
    </div>
  );
};