// PDF parsing using pdfjs-dist
import * as pdfjsLib from "pdfjs-dist";
// Use the bundled worker via Vite ?url import
// @ts-ignore - vite handles ?url
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

export async function extractText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => ("str" in it ? it.str : ""));
    text += "\n" + rebuildLines(strings);
  }
  return normalizeExtractedText(text);
}

// Heuristic syllabus parser: looks for "Unit", "Module" or "Chapter" headings.
export function parseSyllabus(text: string): { name: string; topics: string[] }[] {
  const lines = normalizeExtractedText(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const units: { name: string; topics: string[] }[] = [];
  let current: { name: string; topics: string[] } | null = null;
  const unitRe =
    /^(unit|module|chapter)\s*[-:]?\s*([0-9IVX]+|[A-Z])\b(.*)$/i;
  let ignoringBooks = false;

  for (const line of lines) {
    const cleanedLine = cleanupLine(line);
    
    if (/^(text\s*books?|reference\s*books?|suggested\s*readings?|bibliography)\b/i.test(cleanedLine)) {
      ignoringBooks = true;
      continue;
    }

    const m = cleanedLine.match(unitRe);
    if (m) {
      ignoringBooks = false;
      if (current) units.push(current);
      current = {
        name: normalizeUnitName(`${capitalize(m[1])} ${m[2]}`),
        topics: [],
      };
      const inlineTopics = splitTopicCandidates(m[3] || "");
      for (const topic of inlineTopics) pushTopic(current.topics, topic);
      continue;
    }
    
    if (ignoringBooks) continue;

    if (current) {
      for (const part of splitTopicCandidates(cleanedLine)) {
        pushTopic(current.topics, part);
      }
    }
  }
  if (current) units.push(current);

  // Fallback: if nothing detected, chunk text into pseudo-units
  if (units.length === 0) {
    const chunks = chunkText(text, 5);
    return chunks.map((c, i) => ({
      name: `Unit ${i + 1}`,
      topics: dedupeTopics(extractKeyPhrases(c).slice(0, 8)).filter(isInformativeTopic),
    }));
  }
  return units
    .map((unit, index) => {
      const topics = dedupeTopics(unit.topics).filter(isInformativeTopic);
      return {
        name: normalizeUnitName(unit.name || `Unit ${index + 1}`),
        topics,
      };
    })
    .slice(0, 5)
    .map((unit, index) => ({
      name: normalizeUnitName(unit.name || `Unit ${index + 1}`),
      topics: unit.topics,
    }))
    .slice(0, 5);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function chunkText(text: string, n: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const size = Math.max(1, Math.ceil(sentences.length / n));
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += size) {
    out.push(sentences.slice(i, i + size).join(" "));
  }
  return out;
}

const STOPWORDS = new Set(
  "a an the and or of to in on for with by is are was were be been being this that these those it as at from which what who whom where when how why all any each every some such no not so than then there here their our your his her its also into more most other only own same too very can will just should now do does did has have had been you we they i".split(
    /\s+/
  )
);

export function extractKeyPhrases(text: string, max = 50): string[] {
  const freq = new Map<string, number>();
  const words = text.toLowerCase().match(/\b[a-z][a-z\-]{2,}\b/g) || [];
  // bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i], b = words[i + 1];
    if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    const k = `${a} ${b}`;
    freq.set(k, (freq.get(k) || 0) + 1);
  }
  // unigrams (less weight)
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 4) continue;
    freq.set(w, (freq.get(w) || 0) + 0.4);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

// Parse PYQ: split into questions. Heuristic — look for Q1, 1., (1), etc. and "[N marks]" patterns.
export function parseQuestions(text: string): { text: string; marks: number }[] {
  let cleaned = normalizeExtractedText(text);
  
  // Find the exact start of the paper (Q1, Q.1, Q. 1) to ignore all preceding boilerplate.
  const startMatch = cleaned.match(/(?:^|\n|\b)\s*q(?:uestion)?\s*\.?\s*1\b/i);
  if (startMatch && startMatch.index !== undefined) {
    cleaned = cleaned.slice(startMatch.index);
  } else {
    // Fallback if paper doesn't use Q1
    const firstQuestionMatch = cleaned.match(/(?:^|\n|(?<=[.:;]))\s*(?:q(?:uestion)?\.?\s*\d+[a-z]?|\d{1,2}[.)]|\([0-9]{1,2}\))\s+/i);
    if (firstQuestionMatch && firstQuestionMatch.index !== undefined) {
      cleaned = cleaned.slice(firstQuestionMatch.index);
    }
  }

  const prepared = cleaned
    .replace(
      /(?:^|\n)\s*(section|part)\s+([a-z0-9ivx]+)\s*[:\-]?\s*/gi,
      "\n$1 $2\n"
    )
    .replace(/(?:^|\n|(?<=[.:;]))\s*(q(?:uestion)?\.?\s*\d+[a-z]?)/gi, "\n$1 ")
    .replace(/(?:^|\n|(?<=[.:;]))\s*(\d{1,2}[.)]\s+)/g, "\n$1")
    .replace(/(?:^|\n|(?<=[.:;]))\s*(\([0-9]{1,2}\)\s+)/g, "\n$1")
    .replace(/(?:^|\n|(?<=[.:;]))\s*([a-z]\)|\([a-z]\))\s+/gi, "\n$1 ")
    .replace(
      /((?:\d{1,2}\s*(?:marks?|m|mks?)\s*[\])}]?)|(?:[\])}]\s*\d{1,2}\s*(?:marks?|m|mks?)))(?=\s+(?:q(?:uestion)?\.?\s*\d+[a-z]?|\d{1,2}[.)]|\([0-9]{1,2}\)|[a-z]\)|\([a-z]\)))/gi,
      "$1\n"
    );

  const parts = prepared.split(
    /\n(?=(?:q(?:uestion)?\.?\s*\d+[a-z]?|\d{1,2}[.)]|\([0-9]{1,2}\)|[a-z]\)|\([a-z]\))\s*)/i
  );
  const items: { text: string; marks: number }[] = [];
  const seen = new Set<string>();
  for (const raw of parts) {
    const t = cleanupQuestionText(raw);
    const tBody = t.replace(/^(?:q(?:uestion)?\.?\s*\d+[a-z]?|\d{1,2}[.)]|\([0-9]{1,2}\))\s*/i, "").trim();
    if (tBody.length < 15) continue;
    
    // skip headings and instructions
    if (INSTRUCTION_PATTERNS.some((p) => p.test(tBody))) continue;

    const marksMatch = t.match(
      /(?:\[|\()?\s*(\d{1,2})\s*(?:marks?|m|mks?)\s*(?:\]|\))?|marks?\s*[:\-]?\s*(\d{1,2})/i
    );
    const marksValue = marksMatch?.[1] || marksMatch?.[2];
    const marks = marksValue ? parseInt(marksValue, 10) : guessMarks(t);
    const normalized = t.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    items.push({ text: t.slice(0, 900), marks });
  }
  return items;
}

function guessMarks(t: string): number {
  // crude: long question = more marks
  if (t.length > 300) return 10;
  if (t.length > 150) return 5;
  return 2;
}

function rebuildLines(strings: string[]): string {
  const lines: string[] = [];
  let current = "";

  for (const raw of strings) {
    const token = String(raw || "").trim();
    if (!token) continue;

    if (!current) {
      current = token;
      continue;
    }

    if (shouldBreakLine(current, token)) {
      lines.push(current);
      current = token;
      continue;
    }

    current += needsTightJoin(current, token) ? token : ` ${token}`;
  }

  if (current) lines.push(current);
  return lines.join("\n");
}

function shouldBreakLine(current: string, next: string): boolean {
  if (/^(unit|module|chapter|part|section)\b/i.test(next)) return true;
  if (/^(q(?:uestion)?\.?\s*\d+|\d{1,2}[.)]|\([0-9]{1,2}\))\b/i.test(next)) return true;
  if (/^[\u2022•\-*]/.test(next)) return true;
  if (/(marks?|m|mks?)\s*$/.test(current) && /^(q(?:uestion)?\.?\s*\d+|\d{1,2}[.)]|\([0-9]{1,2}\))\b/i.test(next)) {
    return true;
  }
  return current.length > 85 && /^[A-Z]/.test(next);
}

function needsTightJoin(current: string, next: string): boolean {
  return /[(\[{/-]$/.test(current) || /^[)\]}:;,.!?/-]/.test(next);
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[•●▪◦]/g, "•")
    .replace(/[–—]/g, "-")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanupLine(line: string): string {
  return line
    .replace(/^[\u2022•\-*]+\s*/, "")
    .replace(/^\d+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTopicCandidates(line: string): string[] {
  const normalized = cleanupLine(line)
    .replace(/^\(?[a-z0-9ivx]+\)?[.)-]\s*/i, "")
    .replace(/^(topics?|contents?)\s*[:\-]\s*/i, "");

  if (!normalized || isProbablyNonTopicLine(normalized)) return [];

  const colonParts =
    normalized.includes(":") && !/^(unit|module|chapter|part)\b/i.test(normalized)
      ? normalized.split(/\s*:\s*/)
      : [normalized];

  return colonParts
    .flatMap((part) => part.split(/\s*[;,]\s*|\s+[|/]\s+|\s+->\s+|\s+→\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && part.length <= 120)
    .filter((part) => !isProbablyNonTopicLine(part))
    .filter(isInformativeTopic);
}

function isProbablyNonTopicLine(line: string): boolean {
  return /^(scheme|reference|textbook|books?|outcomes?|credits?|hours?|exam|internal|external|time|max(?:imum)? marks?)\b/i.test(
    line
  );
}

function looksLikeTopicList(line: string): boolean {
  return line.includes(",") || /^[\u2022•\-*]/.test(line);
}

function pushTopic(target: string[], topic: string) {
  const cleaned = topic
    .replace(/^\(?[a-z0-9ivx]+\)?[.)-]\s*/i, "")
    .replace(/\.+$/g, "")
    .trim();
  if (!cleaned || cleaned.length < 3 || !isInformativeTopic(cleaned)) return;
  target.push(cleaned);
}

function dedupeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const topic of topics) {
    const key = topic.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
  }
  return out;
}

function cleanupQuestionText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/(?:\b(?:section|part)\s+[a-z0-9ivx]+\b\s*)+/gi, "")
    .replace(/\b(?:attempt any|answer any|attempt all|answer all|all questions are compulsory)[^.]*\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnitName(name: string): string {
  const match = cleanupLine(name).match(/(unit|module|chapter)\s*([0-9IVX]+|[A-Z])/i);
  if (!match) return name.trim();
  return `Unit ${match[2].toUpperCase()}`;
}

function isInformativeTopic(topic: string): boolean {
  const cleaned = normalizeTopic(topic);
  if (!cleaned || cleaned.length < 3) return false;
  if (GENERIC_TOPIC_PATTERNS.some((pattern) => pattern.test(cleaned))) return false;

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return false;

  const meaningfulWords = words.filter((word) => word.length > 2 && !STOPWORDS.has(word));
  if (meaningfulWords.length === 0) return false;
  if (meaningfulWords.length === 1 && meaningfulWords[0].length < 5) return false;

  return true;
}

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const GENERIC_TOPIC_PATTERNS = [
  /^general topics?$/,
  /^introduction$/,
  /^overview$/,
  /^course outcomes?$/,
  /^learning outcomes?$/,
  /^in this course$/,
  /^basics?$/,
  /^applications?$/,
  /^(reference|text)?\s*books?$/,
  /^model question paper$/,
  /\b(press|publication|published by|edition)\b/i,
  /^references?$/i,
  /^bibliography$/i,
  /^suggested readings?$/i,
  /author\s+/,
  /author:/,
];

const INSTRUCTION_PATTERNS = [
  /^section\b/i,
  /^part\b/i,
  /^instructions?(?:\s|to|for|:)/i,
  /^time\s*[:\-]?\s*\d/i,
  /^max\.?\s*marks?/i,
  /^note\s*[:\-]/i,
  /^candidates are required/i,
  /^figures in the margin/i,
  /^answer any/i,
  /^attempt any/i,
  /^answer all/i,
  /^attempt all/i,
  /^all questions are/i,
  /^illustrate your answers?/i,
  /^assume suitable data/i,
  /^marks are indicated/i,
  /^paper\s*code/i,
  /^roll\s*no/i,
  /^course\s*code/i,
  /^subject\s*code/i,
  /^semester/i,
  /^b\.?\s*tech/i,
  /^degree\s*examination/i,
  /^end\s*semester/i,
  /^evaluate the following/i,
  /^each question carries/i,
  /^use of(?:.*)?calculators? is allowed/i,
  /calculators? is allowed/i,
  /^question (?:no\.?\s*)?\d+\s*(?:will be|is) compulsory/i,
  /include objective-?type questions/i,
  /technological university/i,
  /bachelor of technology/i,
  /^course\s*:/i,
  /^program(?:me)?\s*:/i,
  /^branch\s*:/i,
  /^date\s*:/i,
  /solve\s+(?:any\s+(?:one|two|three|four|five)|the\s+following)/i,
  /answer\s+(?:any\s+(?:one|two|three|four|five)|the\s+following)/i,
  /attempt\s+(?:any\s+(?:one|two|three|four|five)|the\s+following)/i,
  /^q(?:\.?\s*\d+[a-z]?)?[\.\-\s]*solve\b/i,
  /^q(?:\.?\s*\d+[a-z]?)?[\.\-\s]*answer\b/i,
  /^q(?:\.?\s*\d+[a-z]?)?[\.\-\s]*attempt\b/i,
  /objective\s+type\s+questions/i,
  /compulsory\s+questions?/i,
];
