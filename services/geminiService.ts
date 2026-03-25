import { GoogleGenAI, Type } from "@google/genai";
import { BookContent, LayoutConfig } from "../types";
import { ParsedDoc } from "./wordParser";

const DEFAULT_LAYOUT: LayoutConfig = {
  mainHeightPercentage: 40,
  commentarySplitPercentage: 50,
  mode: 'wrap-a'
};

export const generateBookContent = async (topic: string, isRtl: boolean): Promise<BookContent | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const language = isRtl ? "Hebrew" : "English";
  const style = isRtl ? "Rabbinical/Talmudic" : "Academic/Philosophical";

  const prompt = `
    Generate a layout content object for a single page of a book.
    Topic: "${topic}".
    Language: ${language}.
    Style: ${style}.
    
    Structure:
    1. Main Text: A central thesis. Insert HTML superscript tags (e.g., <sup>1</sup>) to reference footnotes.
    2. Commentary A: Analysis corresponding to the superscripts. Start lines with <b>1.</b> matching the superscripts.
    3. Commentary B: Additional context or contrasting view.
    
    Ensure the content is formatted with HTML tags (<p>, <b>, <br>).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            pageNumber: { type: Type.STRING },
            mainTextHeader: { type: Type.STRING },
            mainTextContent: { type: Type.STRING },
            commAHeader: { type: Type.STRING },
            commAContent: { type: Type.STRING },
            commBHeader: { type: Type.STRING },
            commBContent: { type: Type.STRING },
          },
          required: ["title", "pageNumber", "mainTextContent", "commAContent", "commBContent"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");

    return {
      title: data.title || "Untitled",
      pageNumber: data.pageNumber || "1",
      direction: isRtl ? 'rtl' : 'ltr',
      layout: DEFAULT_LAYOUT,
      mainText: {
        id: 'main',
        label: data.mainTextHeader || (isRtl ? "מקור" : "Primary Source"),
        content: data.mainTextContent || "",
      },
      commentaryA: {
        id: 'commA',
        label: data.commAHeader || (isRtl ? "מקור השפע" : "Commentary A"),
        content: data.commAContent || "",
      },
      commentaryB: {
        id: 'commB',
        label: data.commBHeader || (isRtl ? "צינור השפע" : "Commentary B"),
        content: data.commBContent || "",
      }
    };

  } catch (error) {
    console.error("Failed to generate content:", error);
    return null;
  }
};

/**
 * THE TYPESETTER ENGINE
 * Uses a "Bucket" system to flow text fluidly across pages.
 */
export const paginateBook = async (input: any): Promise<BookContent[] | null> => {
    
    // 1. Handle Raw JSON Legacy Path (Small Files)
    if (input.mainHtml === undefined) {
       // Legacy AI method for raw JSON
       return paginateLegacyJson(input);
    }

    // 2. Deterministic "Funnel" Typesetting for Docx
    const doc = input as ParsedDoc;
    const pages: BookContent[] = [];
    
    // --- Configuration ---
    // Approx chars per page section. 
    // This is a heuristic. In a real engine we'd measure pixels.
    const MAIN_CHARS_PER_PAGE = 1100; 
    const COMM_A_CHARS_PER_PAGE = 900;
    const COMM_B_CHARS_PER_PAGE = 900;
    
    // --- Buffers (The "Buckets") ---
    // We split Main Text by paragraphs to preserve formatting
    const mainParagraphs = doc.mainHtml.split(/(?=<\/p>)/i).map(p => p.replace('</p>', '</p>|')).join('').split('|').filter(p => p.trim().length > 0);
    
    let mainIndex = 0;
    let commABucket = ""; // Accumulates content for Source of Plenty
    let commBBucket = ""; // Accumulates content for Conduit of Plenty

    // We keep track of which footnotes/endnotes have been "triggered" by the main text so far
    const triggeredFootnotes = new Set<string>();
    const triggeredEndnotes = new Set<string>();

    let pageNum = 1;

    // Detect direction
    const isHebrew = /[\u0590-\u05FF]/.test(doc.mainHtml.substring(0, 1000));
    const direction = isHebrew ? 'rtl' : 'ltr';

    while (mainIndex < mainParagraphs.length || commABucket.length > 0 || commBBucket.length > 0) {
        
        // --- Step 1: Fill Main Text for this Page ---
        let currentMainText = "";
        
        // Only add main text if we have some left
        while (currentMainText.length < MAIN_CHARS_PER_PAGE && mainIndex < mainParagraphs.length) {
            const para = mainParagraphs[mainIndex];
            
            // Check if adding this paragraph makes it too long (unless it's the only paragraph)
            if (currentMainText.length > 0 && currentMainText.length + para.length > MAIN_CHARS_PER_PAGE * 1.2) {
                break; // Stop, it's full enough
            }

            currentMainText += para;
            mainIndex++;

            // --- Step 2: Trigger Commentaries ---
            // Scan this paragraph for references and dump them into the buckets
            // Look for id="footnote-ref-X" or href="#footnote-X"
            // Mammoth format: <a href="#footnote-X" id="footnote-ref-X">[X]</a>
            
            // Regex to find footnote IDs mentioned in this chunk
            const fnMatches = para.matchAll(/href="#footnote-([0-9]+)-(\d+)"|href="#footnote-(\d+)"/g);
            for (const match of fnMatches) {
               const id = `footnote-${match[1] || match[3]}`; 
               // Note: Mammoth IDs can be tricky, we fallback to strict checking
               // We iterate our parsed dict keys to find matches if needed, but direct ID lookup is faster
               
               // Actually, let's just scan the dict keys.
               // Optimization: The parser gave us IDs.
               // Let's rely on the parser's ordered lists for safety if exact ID match fails? 
               // No, simple ID match is best.
               
               if (doc.footnotes[id] && !triggeredFootnotes.has(id)) {
                   commABucket += `<div><b>${Object.keys(triggeredFootnotes).length + 1}.</b> ${doc.footnotes[id]}</div><br/>`;
                   triggeredFootnotes.add(id);
               }
            }

            // Regex for endnotes
             const enMatches = para.matchAll(/href="#endnote-([0-9]+)-(\d+)"|href="#endnote-(\d+)"/g);
             for (const match of enMatches) {
                const id = `endnote-${match[1] || match[3]}`;
                if (doc.endnotes[id] && !triggeredEndnotes.has(id)) {
                    commBBucket += `<div><b>*</b> ${doc.endnotes[id]}</div><br/>`;
                    triggeredEndnotes.add(id);
                }
             }
        }

        // --- Step 3: Pour Commentaries from Buckets ---
        // "Spill" logic: Take up to limit, leave the rest in bucket for next page
        
        // Smart split: try not to cut inside a tag. 
        // Simple HTML safe split: Split by <br/> or </div> if possible. 
        // If the bucket is huge, we just take characters and clean up.
        
        const getChunkFromBucket = (bucket: string, limit: number): { chunk: string, remaining: string } => {
            if (bucket.length <= limit) return { chunk: bucket, remaining: "" };
            
            // Try to find a safe break point near the limit
            let cutIndex = bucket.lastIndexOf("</div>", limit);
            if (cutIndex === -1 || cutIndex < limit * 0.5) cutIndex = bucket.lastIndexOf("<br/>", limit);
            if (cutIndex === -1 || cutIndex < limit * 0.5) cutIndex = bucket.lastIndexOf(" ", limit);
            if (cutIndex === -1) cutIndex = limit; // Hard cut if no spaces (rare)

            // Adjust cut index to include the closing tag
            if (bucket.substring(cutIndex).startsWith("</div>")) cutIndex += 6;
            else if (bucket.substring(cutIndex).startsWith("<br/>")) cutIndex += 5;

            return {
                chunk: bucket.substring(0, cutIndex),
                remaining: bucket.substring(cutIndex)
            };
        };

        const commAResult = getChunkFromBucket(commABucket, COMM_A_CHARS_PER_PAGE);
        const commBResult = getChunkFromBucket(commBBucket, COMM_B_CHARS_PER_PAGE);

        const pageCommA = commAResult.chunk;
        commABucket = commAResult.remaining;

        const pageCommB = commBResult.chunk;
        commBBucket = commBResult.remaining;

        // --- Step 4: Build Page ---
        // If we have nothing at all, stop (eof)
        if (!currentMainText && !pageCommA && !pageCommB) break;

        pages.push({
            title: "Uploaded Manuscript",
            pageNumber: pageNum.toString(),
            direction: direction,
            layout: { ...DEFAULT_LAYOUT, mode: 'wrap-a', mainHeightPercentage: 40 },
            mainText: {
                id: 'main',
                label: isHebrew ? 'גוף הספר' : 'Main Text',
                content: currentMainText
            },
            commentaryA: {
                id: 'commA',
                label: isHebrew ? 'מקור השפע' : 'Footnotes',
                content: pageCommA
            },
            commentaryB: {
                id: 'commB',
                label: isHebrew ? 'צינור השפע' : 'Endnotes',
                content: pageCommB
            }
        });

        pageNum++;
        
        // Safety break for infinite loops
        if (pageNum > 200) break;
    }

    return pages;
}


// --- Legacy Helper for JSON ---
async function paginateLegacyJson(input: any): Promise<BookContent[] | null> {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Simplified legacy logic...
    try {
        const prompt = `Typeset this into pages: ${JSON.stringify(input).substring(0, 10000)}`;
         const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        pages: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    pageNumber: { type: Type.STRING },
                                    mainTextHTML: { type: Type.STRING },
                                    footnotesHTML: { type: Type.STRING },
                                    endnotesHTML: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });
        const result = JSON.parse(response.text || "{}");
        if (result.pages) {
             return result.pages.map((p: any) => ({
                title: "Legacy Import",
                pageNumber: p.pageNumber,
                direction: 'ltr',
                layout: DEFAULT_LAYOUT,
                mainText: { id: 'm', label: 'Main', content: p.mainTextHTML },
                commentaryA: { id: 'a', label: 'A', content: p.footnotesHTML },
                commentaryB: { id: 'b', label: 'B', content: p.endnotesHTML },
            }));
        }
    } catch(e) { console.error(e); }
    return null;
}