import React, { useState } from 'react';
import { BookPage } from './components/BookPage';
import { EditorPanel } from './components/EditorPanel';
import { BookContent, LayoutConfig, SectionType } from './types';
import { generateBookContent } from './services/geminiService';

// Default initial state matching a typical Chumash/Gemara layout
const INITIAL_LAYOUT: LayoutConfig = {
  mainHeightPercentage: 40,
  commentarySplitPercentage: 40,
  mode: 'wrap-a', 
};

const INITIAL_CONTENT: BookContent = {
  title: "Sefer Bereshit",
  pageNumber: "12A",
  direction: 'rtl',
  layout: INITIAL_LAYOUT,
  mainText: {
    id: 'main',
    label: 'בראשית פרק א',
    content: `בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ. וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל פְּנֵי תְהוֹם וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל פְּנֵי הַמָּיִם. וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי אוֹר. וַיַּרְא אֱלֹהִים אֶת הָאוֹר כִּי טוֹב וַיַּבְדֵּל אֱלֹהִים בֵּין הָאוֹר וּבֵין הַחֹשֶׁךְ. וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם וְלַחֹשֶׁךְ קָרָא לָיְלָה וַיְהִי עֶרֶב וַיְהִי בֹקֶר יוֹם אֶחָד.`
  },
  commentaryA: {
    id: 'commA',
    label: 'רש״י (Anchor)',
    content: `<b>1.</b> בראשית ברא - אמר רבי יצחק לא היה צריך להתחיל את התורה אלא מהחודש הזה לכם, שהיא מצוה ראשונה שנצטוו בה ישראל, ומה טעם פתח בבראשית? משום כח מעשיו הגיד לעמו לתת להם נחלת גוים.`
  },
  commentaryB: {
    id: 'commB',
    label: 'רמב״ן (Flowing)',
    content: `בראשית ברא אלהים - הקב"ה ברא את העולם יש מאין מוחלט. והטעם, כי בראשית בריאת העולם לא היה דבר קודם, אלא המציא את הכל מן האפס המוחלט.`
  }
};

const App: React.FC = () => {
  const [pages, setPages] = useState<BookContent[]>([INITIAL_CONTENT]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionType>(SectionType.MAIN);
  const [isGenerating, setIsGenerating] = useState(false);

  // Helper to update current page content
  const handleContentChange = (newContent: BookContent) => {
    const newPages = [...pages];
    newPages[currentPageIndex] = newContent;
    setPages(newPages);
  };

  const handleLayoutChange = (newConfig: LayoutConfig) => {
    const newPages = [...pages];
    newPages[currentPageIndex] = { ...newPages[currentPageIndex], layout: newConfig };
    setPages(newPages);
  };

  const handleBookLoaded = (newPages: BookContent[]) => {
    setPages(newPages);
    setCurrentPageIndex(0);
  };

  // Handle generative AI request (Single Page)
  const handleGenerate = async () => {
    setIsGenerating(true);
    const topic = prompt("What topic/text should we generate layout for?", "Philosophical debate about Time");
    if (topic) {
      const currentDir = pages[currentPageIndex].direction === 'rtl';
      const newContent = await generateBookContent(topic, currentDir);
      if (newContent) {
        handleContentChange(newContent);
      } else {
        alert("Could not generate content. Please check your API key.");
      }
    }
    setIsGenerating(false);
  };

  const nextPage = () => {
    if (currentPageIndex < pages.length - 1) setCurrentPageIndex(prev => prev + 1);
  };

  const prevPage = () => {
    if (currentPageIndex > 0) setCurrentPageIndex(prev => prev - 1);
  };

  const content = pages[currentPageIndex];

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-stone-100">
      
      {/* Left Panel: Editing Domain */}
      <div className="w-full md:w-1/3 lg:w-96 flex-shrink-0 h-[40vh] md:h-full relative transition-all duration-300 ease-in-out border-r border-stone-200 z-30">
        <EditorPanel 
          content={content} 
          onLayoutConfigChange={handleLayoutChange}
          activeSection={activeSection} 
          onContentChange={handleContentChange}
          onSectionSelect={setActiveSection}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onBookLoaded={handleBookLoaded}
        />
      </div>

      {/* Right Panel: Layout Visualization */}
      <div className="flex-1 h-[60vh] md:h-full flex flex-col items-center bg-stone-300/80 backdrop-blur-sm relative overflow-y-auto">
        
        {/* Pagination Controls */}
        <div className="sticky top-4 z-40 flex items-center gap-4 bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow-lg border border-stone-200 mb-8 mt-4">
           <button 
             onClick={prevPage} 
             disabled={currentPageIndex === 0}
             className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-bold text-stone-600"
           >
             ←
           </button>
           <span className="text-sm font-header font-bold text-stone-700 min-w-[80px] text-center">
             Page {currentPageIndex + 1} of {pages.length}
           </span>
           <button 
             onClick={nextPage} 
             disabled={currentPageIndex === pages.length - 1}
             className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-bold text-stone-600"
           >
             →
           </button>
        </div>

        {/* The Book Container */}
        <div className="w-full flex-1 flex items-start justify-center p-4 md:p-8 lg:p-12 pb-20">
          {/* We constrain width to approximate screen size of page, but height is determined by aspect ratio */}
          <div className="w-full max-w-[calc(90vh*0.77)] shadow-2xl">
              <BookPage 
                content={content} 
                onLayoutChange={handleLayoutChange} 
              />
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;