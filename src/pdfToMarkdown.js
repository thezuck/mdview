import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// Simple, reliable PDF text extraction
export const convertPdfToMarkdown = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    let fullText = '';

    // First pass: detect which fonts are used most (regular vs bold)
    let allItems = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      textContent.items.forEach(item => {
        allItems.push({
          fontName: item.fontName || '',
          fontSize: Math.abs(item.transform[0]),
        });
      });
    }
    
    // Determine which fonts are bold by analyzing font usage
    const fontCounts = {};
    allItems.forEach(item => {
      if (!fontCounts[item.fontName]) {
        fontCounts[item.fontName] = 0;
      }
      fontCounts[item.fontName]++;
    });
    
    // The most common font is likely the regular font
    const sortedFonts = Object.entries(fontCounts).sort((a, b) => b[1] - a[1]);
    const regularFont = sortedFonts[0]?.[0];
    
    console.log('Font analysis:', sortedFonts.map(([font, count]) => `${font}: ${count}`).join(', '));
    console.log('Regular font:', regularFont);

    // Extract text from each page in reading order
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Group items by Y position (vertical lines)
      const lines = {};
      
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        const fontSize = Math.abs(item.transform[0]);
        const fontName = item.fontName || '';
        
        // Check if text is bold
        // Method 1: Font name contains bold/heavy/black
        // Method 2: Font is different from the regular font (likely bold/heading)
        const isBold = fontName.toLowerCase().includes('bold') || 
                       fontName.toLowerCase().includes('heavy') ||
                       fontName.toLowerCase().includes('black') ||
                       (fontName !== regularFont && fontName !== '');
        
        // Detect if this is a citation (superscript or small number, or standalone number at end of sentence)
        const textTrimmed = item.str.trim();
        const isCitation = /^\d+$/.test(textTrimmed) && fontSize < 10;
        
        if (!lines[y]) {
          lines[y] = [];
        }
        
        lines[y].push({
          text: item.str,
          x: item.transform[4],
          isBold,
          isCitation,
          fontSize,
          fontName, // Keep for debugging
        });
      });

      // Sort lines from top to bottom
      const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);

      // Build page text
      let pageText = '';
      sortedYs.forEach(y => {
        // Sort items in line from left to right
        const lineItems = lines[y].sort((a, b) => a.x - b.x);
        
        // Build line with formatting
        let lineText = '';
        
        lineItems.forEach((item, idx) => {
          // Skip citations
          if (item.isCitation) {
            return;
          }
          
          // Just concatenate all text as-is
          if (item.isBold) {
            lineText += '**' + item.text + '**';
          } else {
            lineText += item.text;
          }
        });
        
        if (lineText.trim()) {
          // Add the line with a newline
          pageText += lineText + '\n';
        }
      });

      if (pageNum > 1) {
        fullText += '\n\n';
      }
      fullText += pageText;
    }

    if (!fullText.trim()) {
      throw new Error('No text content found in PDF');
    }

    // Convert to markdown with basic formatting
    let markdown = formatAsMarkdown(fullText, file.name);
    
    // Post-process: Remove any remaining citation numbers
    // Remove standalone numbers at end of sentences or lines
    markdown = markdown.replace(/\s+\d+\s*$/gm, '');  // End of line citations
    markdown = markdown.replace(/\s+\d+\s+/g, ' ');   // Mid-line standalone numbers
    markdown = markdown.replace(/\.\s*\d+\s/g, '. '); // After periods
    
    // Fix bold formatting issues - AGGRESSIVE CLEANUP
    // 1. First merge consecutive bold on same line
    const lines = markdown.split('\n');
    markdown = lines.map(line => {
      // Merge consecutive bolds on this line
      let cleaned = line;
      for (let i = 0; i < 10; i++) {
        const before = cleaned;
        cleaned = cleaned.replace(/\*\*([^*\n]+)\*\*\s?\*\*([^*\n]+)\*\*/g, '**$1 $2**');
        if (before === cleaned) break;
      }
      return cleaned;
    }).join('\n');
    
    // 2. Fix the specific pattern: word space ** → word** space
    // Example: "application **" → "application**" (space moved outside)
    markdown = markdown.replace(/(\S)\s+\*\*/g, '$1** ');
    
    // 3. Fix bold with spaces inside: ** text ** → **text**
    // Match ** with any content (including spaces) and trim it
    markdown = markdown.replace(/\*\*\s*([^*]+?)\s*\*\*/g, (match, content) => {
      const trimmed = content.trim();
      return trimmed ? `**${trimmed}**` : '';
    });
    
    // 4. Remove empty bold markers
    markdown = markdown.replace(/\*\*\*\*/g, '');
    markdown = markdown.replace(/\*\*\s*\*\*/g, '');
    
    // 5. Add space before opening ** if missing
    markdown = markdown.replace(/([^\s\n*])(\*\*[^\s*])/g, '$1 $2');
    
    // 6. Add space after closing ** if missing (but not before punctuation)
    markdown = markdown.replace(/([^\s*]\*\*)([^\s*.,;:!?)\]\n])/g, '$1 $2');
    
    // 7. Clean up multiple spaces
    markdown = markdown.replace(/  +/g, ' ');

    return {
      success: true,
      markdown,
      originalName: file.name.replace(/\.pdf$/i, '.md'),
      pageCount: numPages,
      info: { pages: numPages }
    };
  } catch (error) {
    console.error('PDF conversion error:', error);
    return {
      success: false,
      error: error.message || 'Failed to convert PDF to markdown'
    };
  }
};

// Format extracted text as markdown
function formatAsMarkdown(text, fileName) {
  let markdown = `# ${fileName.replace(/\.pdf$/i, '')}\n\n`;
  
  // Split into lines
  const lines = text.split('\n');
  
  let inList = false;
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    if (!trimmed) {
      if (inList) {
        markdown += '\n';
        inList = false;
      }
      markdown += '\n';
      return;
    }
    
    // Check if line contains bullets in the middle and split them
    const bulletChars = '[•●○■□▪▫✓✗◆◇★☆➤➢⮞]';
    const bulletRegex = new RegExp(bulletChars, 'g');
    
    if (bulletRegex.test(trimmed)) {
      // Split on bullet points
      const parts = trimmed.split(new RegExp(`(${bulletChars})`));
      let currentText = '';
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;
        
        // Check if this is a bullet character
        if (new RegExp(`^${bulletChars}$`).test(part)) {
          // If we have accumulated text before this bullet, output it
          if (currentText) {
            if (inList) {
              markdown += '\n';
              inList = false;
            }
            markdown += currentText + '\n';
            currentText = '';
          }
          
          // Next part after bullet is the list item
          const nextPart = parts[i + 1];
          if (nextPart && nextPart.trim()) {
            markdown += `- ${nextPart.trim()}\n`;
            inList = true;
            i++; // Skip the next part since we used it
          }
        } else if (!parts[i - 1] || !new RegExp(`^${bulletChars}$`).test(parts[i - 1].trim())) {
          // This is regular text (not following a bullet)
          currentText += part + ' ';
        }
      }
      
      // Output any remaining text
      if (currentText.trim()) {
        if (inList) {
          markdown += '\n';
          inList = false;
        }
        markdown += currentText.trim() + '\n';
      }
      return;
    }
    
    // Detect bullet points at the start of line
    const bulletMatch = trimmed.match(/^([•●○■□▪▫✓✗◆◇★☆➤➢⮞]+|[-–—])\s+(.+)/);
    
    // Detect numbered lists
    const numberedMatch = trimmed.match(/^(\d+[\.\)]\s+|[a-z][\.\)]\s+|[ivxlcdm]+[\.\)]\s+)(.+)/i);
    
    if (bulletMatch) {
      // Convert to markdown unordered list
      markdown += `- ${bulletMatch[2]}\n`;
      inList = true;
    } else if (numberedMatch) {
      // Convert to markdown ordered list
      markdown += `1. ${numberedMatch[2]}\n`;
      inList = true;
    } else {
      // Regular text
      if (inList) {
        markdown += '\n';
        inList = false;
      }
      markdown += trimmed + '\n';
    }
  });
  
  // Clean up excessive newlines
  markdown = markdown.replace(/\n{4,}/g, '\n\n');
  
  return markdown;
}
