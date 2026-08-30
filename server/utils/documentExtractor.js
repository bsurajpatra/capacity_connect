const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const officeParser = require('officeparser');

/**
 * Decode XML entities to clean text
 */
const decodeXmlEntities = (str) => {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
};

/**
 * Extract clean slide text from PPTX archive
 */
const extractPptxTextFromZip = (fileBuffer) => {
  try {
    const zip = new AdmZip(fileBuffer);
    const entries = zip.getEntries();
    const slideEntries = entries
      .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.entryName.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });

    const extractedSlides = [];

    for (const entry of slideEntries) {
      const xml = entry.getData().toString('utf8');
      const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/gi) || [];
      const textPieces = matches
        .map((m) => decodeXmlEntities(m.replace(/<[^>]+>/g, '').trim()))
        .filter((t) => t.length > 0);

      if (textPieces.length > 0) {
        extractedSlides.push(textPieces.join(' '));
      }
    }

    // Also look for slide notes
    const noteEntries = entries.filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(e.entryName));
    for (const entry of noteEntries) {
      const xml = entry.getData().toString('utf8');
      const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/gi) || [];
      const textPieces = matches
        .map((m) => decodeXmlEntities(m.replace(/<[^>]+>/g, '').trim()))
        .filter((t) => t.length > 0 && !t.includes('Slide '));

      if (textPieces.length > 0) {
        extractedSlides.push(textPieces.join(' '));
      }
    }

    return extractedSlides.join('\n\n');
  } catch (err) {
    console.warn('PPTX zip extraction warning:', err.message);
    return '';
  }
};

/**
 * Extract clean document text from DOCX archive
 */
const extractDocxTextFromZip = (fileBuffer) => {
  try {
    const zip = new AdmZip(fileBuffer);
    const docEntry = zip.getEntry('word/document.xml');
    if (docEntry) {
      const xml = docEntry.getData().toString('utf8');
      const matches = xml.match(/<w:t[^>]*>(.*?)<\/w:t>/gi) || [];
      const textPieces = matches
        .map((m) => decodeXmlEntities(m.replace(/<[^>]+>/g, '').trim()))
        .filter((t) => t.length > 0);
      return textPieces.join(' ');
    }
  } catch (err) {
    console.warn('DOCX zip extraction warning:', err.message);
  }
  return '';
};

/**
 * Clean and filter raw text, removing binary noise, XML tags, or zip markers
 */
const sanitizeExtractedText = (text) => {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // Filter out any raw binary or zip headers
  if (sanitized.startsWith('PK\x03\x04') || sanitized.includes('[Content_Types].xml') || sanitized.includes('<?xml')) {
    sanitized = sanitized.replace(/<[^>]+>/g, ' ');
  }

  // Remove unprintable control characters except newline and tab
  const cleaned = sanitized
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/\r?\n\s*\r?\n/g, '\n\n')
    .trim();

  // If the text contains majority non-ascii gibberish (e.g. raw binary dump), return empty
  const nonAsciiCount = (cleaned.match(/[^\x20-\x7E\t\n\r]/g) || []).length;
  if (cleaned.length > 50 && nonAsciiCount / cleaned.length > 0.25) {
    return '';
  }

  return cleaned;
};

/**
 * Extract clean readable text from PDF, DOCX, DOC, PPTX, PPT, or TXT files
 * @param {string} filePath - Absolute path to the uploaded file on disk
 * @param {string} originalName - Original filename with extension
 * @returns {Promise<string>}
 */
const extractTextFromDocument = async (filePath, originalName = '') => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('File not found for document extraction.');
  }

  const ext = (path.extname(originalName || filePath) || '').toLowerCase();
  const fileBuffer = fs.readFileSync(filePath);
  let extractedText = '';

  // 1. PowerPoint Presentations (.pptx, .ppt)
  if (ext === '.pptx' || ext === '.ppt') {
    extractedText = extractPptxTextFromZip(fileBuffer);

    if (!extractedText || extractedText.trim().length < 15) {
      try {
        const officeText = await new Promise((resolve, reject) => {
          officeParser.parseOffice(filePath, (data, err) => {
            if (err) return reject(err);
            resolve(data);
          });
        });
        if (officeText && typeof officeText === 'string') {
          extractedText = officeText;
        }
      } catch (oErr) {
        console.warn('OfficeParser PPTX warning:', oErr.message);
      }
    }
  }

  // 2. Word Documents (.docx, .doc)
  else if (ext === '.docx' || ext === '.doc') {
    try {
      const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
      if (mammothResult.value && mammothResult.value.trim().length > 10) {
        extractedText = mammothResult.value;
      }
    } catch (mErr) {
      console.warn('Mammoth docx extraction warning:', mErr.message);
    }

    if (!extractedText || extractedText.trim().length < 15) {
      extractedText = extractDocxTextFromZip(fileBuffer);
    }

    if (!extractedText || extractedText.trim().length < 15) {
      try {
        const officeText = await new Promise((resolve, reject) => {
          officeParser.parseOffice(filePath, (data, err) => {
            if (err) return reject(err);
            resolve(data);
          });
        });
        if (officeText && typeof officeText === 'string') {
          extractedText = officeText;
        }
      } catch (oErr) {}
    }
  }

  // 3. PDF Documents (.pdf)
  else if (ext === '.pdf') {
    try {
      const parsedData = await pdfParse(fileBuffer);
      extractedText = parsedData.text || '';
    } catch (pdfErr) {
      console.warn('PDF parse error:', pdfErr.message);
    }
  }

  // 4. Plain text / Markdown (.txt, .md, .rtf)
  else if (ext === '.txt' || ext === '.md' || ext === '.rtf') {
    extractedText = fileBuffer.toString('utf-8');
  }

  // 5. Fallback auto-detection
  else {
    extractedText = extractPptxTextFromZip(fileBuffer);
    if (!extractedText) extractedText = extractDocxTextFromZip(fileBuffer);
    if (!extractedText) {
      try {
        const fallbackPdf = await pdfParse(fileBuffer);
        extractedText = fallbackPdf.text || '';
      } catch (e) {}
    }
  }

  const cleanText = sanitizeExtractedText(extractedText);
  return cleanText;
};

module.exports = {
  extractTextFromDocument,
  extractPptxTextFromZip,
  extractDocxTextFromZip,
  sanitizeExtractedText,
};
