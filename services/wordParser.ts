import mammoth from 'mammoth';

export interface ParsedDoc {
  mainHtml: string;
  footnotes: Record<string, string>; // ID -> HTML Content
  endnotes: Record<string, string>;   // ID -> HTML Content
  orderedFootnoteIds: string[]; // Order of appearance
  orderedEndnoteIds: string[]; // Order of appearance
}

export const parseWordFile = async (file: File): Promise<ParsedDoc> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (loadEvent) => {
      const arrayBuffer = loadEvent.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        reject(new Error("Failed to read file"));
        return;
      }

      try {
        // Convert docx to HTML using Mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        const fullHtml = result.value;

        // Parse the HTML string to separate footnotes/endnotes
        const parser = new DOMParser();
        const doc = parser.parseFromString(fullHtml, 'text/html');

        const footnotes: Record<string, string> = {};
        const endnotes: Record<string, string> = {};
        const orderedFootnoteIds: string[] = [];
        const orderedEndnoteIds: string[] = [];

        // 1. Extract Footnotes
        const footnoteElements = doc.querySelectorAll('[id^="footnote-"]');
        footnoteElements.forEach((el) => {
          const id = el.id;
          const backRefs = el.querySelectorAll('a[href^="#footnote-ref"]');
          backRefs.forEach(ref => ref.remove());
          
          footnotes[id] = el.innerHTML.trim();
          el.remove();
        });

        // 2. Extract Endnotes
        const endnoteElements = doc.querySelectorAll('[id^="endnote-"]');
        endnoteElements.forEach((el) => {
          const id = el.id;
          const backRefs = el.querySelectorAll('a[href^="#endnote-ref"]');
          backRefs.forEach(ref => ref.remove());

          endnotes[id] = el.innerHTML.trim();
          el.remove();
        });

        // 3. Clean empty lists
        doc.querySelectorAll('ol, ul').forEach(list => {
          if (list.children.length === 0) list.remove();
        });

        // 4. Determine Order of Appearance in Main Text
        // We scan the main body for links to the notes
        const mainBody = doc.body;
        const refLinks = mainBody.querySelectorAll('a[href^="#footnote-"], a[href^="#endnote-"]');
        
        refLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href?.startsWith('#footnote-')) {
                const id = href.substring(1); // remove #
                // Mammoth sometimes maps #footnote-ref-x -> #footnote-x. 
                // We stored footnotes by their ID (footnote-x).
                // Let's normalize. 
                // Usually href="#footnote-1" matches id="footnote-1".
                if (footnotes[id] && !orderedFootnoteIds.includes(id)) {
                    orderedFootnoteIds.push(id);
                }
            } else if (href?.startsWith('#endnote-')) {
                const id = href.substring(1);
                if (endnotes[id] && !orderedEndnoteIds.includes(id)) {
                    orderedEndnoteIds.push(id);
                }
            }
        });
        
        // Add any orphans that weren't linked but exist (rare, but safe)
        Object.keys(footnotes).forEach(id => {
            if (!orderedFootnoteIds.includes(id)) orderedFootnoteIds.push(id);
        });
        Object.keys(endnotes).forEach(id => {
            if (!orderedEndnoteIds.includes(id)) orderedEndnoteIds.push(id);
        });

        const mainHtml = doc.body.innerHTML;

        resolve({
          mainHtml,
          footnotes,
          endnotes,
          orderedFootnoteIds,
          orderedEndnoteIds
        });

      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};