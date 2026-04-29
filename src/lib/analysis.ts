// Analysis and prediction engines (heuristic, client-side)
import type { PYQUpload, SyllabusUpload } from "./store";
import { extractKeyPhrases } from "./pdf";

export type TopicStat = {
  topic: string;
  frequency: number; // # of questions touching this topic
  totalMarks: number;
  years: Set<string>;
  unit?: string;
};

export type Prediction = {
  topic: string;
  unit?: string;
  score: number; // 0-100
  rationale: string;
};

export type AnalysisSummary = {
  totalQuestions: number;
  matchedQuestions: number;
  coveragePercent: number;
  syllabusTopics: number;
  recurringTopics: number;
  strongestUnit?: string;
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function questionTopicScore(qText: string, topic: string): number {
  const q = normalize(qText);
  const t = normalize(topic);
  if (t.length < 3) return 0;
  if (q.includes(t)) return 1;

  const topicTokens = tokenize(topic);
  if (topicTokens.length === 0) return 0;

  let matched = 0;
  let longestMatched = 0;
  for (const token of topicTokens) {
    if (q.includes(token)) {
      matched += 1;
      longestMatched = Math.max(longestMatched, token.length);
    }
  }

  const overlap = matched / topicTokens.length;
  if (matched === 0) return 0;
  if (matched === 1 && longestMatched < 6 && topicTokens.length > 1) return 0;
  if (topicTokens.length >= 3 && overlap < 0.45) return 0;
  if (topicTokens.length === 2 && overlap < 0.45) return 0;
  return overlap + (longestMatched >= 8 ? 0.1 : 0);
}

function matchQuestionToTopics(
  qText: string,
  topics: { topic: string; unit?: string }[]
): { topic: string; unit?: string; score: number }[] {
  const matches = topics
    .map((entry) => ({
      topic: entry.topic,
      unit: entry.unit,
      score: questionTopicScore(qText, entry.topic),
    }))
    .filter((entry) => entry.score >= 0.45)
    .sort((a, b) => b.score - a.score);

  if (matches.length === 0) return [];
  const bestScore = matches[0].score;
  return matches.filter((entry) => entry.score >= Math.max(0.45, bestScore - 0.15)).slice(0, 2);
}

export function computeTopicStats(
  pyqs: PYQUpload[],
  syllabus: SyllabusUpload | undefined
): TopicStat[] {
  const topics: { topic: string; unit?: string }[] = [];

  if (syllabus) {
    for (const u of syllabus.units) {
      for (const t of u.topics) {
        if (isUsefulTopic(t)) {
          topics.push({ topic: t, unit: canonicalUnitLabel(u.name) });
        }
      }
    }
  }

  // Only fall back to extracted phrases when no syllabus is available.
  if (topics.length === 0) {
    const allText = pyqs.flatMap((p) => p.questions.map((q) => q.text)).join(" ");
    for (const t of extractKeyPhrases(allText, 30)) {
      if (isUsefulTopic(t)) topics.push({ topic: t });
    }
  }

  const map = new Map<string, TopicStat>();
  for (const { topic, unit } of topics) {
    const key = normalize(topic);
    if (!map.has(key)) {
      map.set(key, { topic, unit, frequency: 0, totalMarks: 0, years: new Set() });
    }
  }

  for (const pyq of pyqs) {
    for (const q of pyq.questions) {
      const matches = matchQuestionToTopics(q.text, topics);
      if (matches.length > 0) {
        const bestMatch = matches[0]; // Assign marks to the single best match to avoid double counting
        const stat = map.get(normalize(bestMatch.topic));
        if (stat) {
          stat.frequency += 1;
          stat.totalMarks += q.marks || 0;
          stat.years.add(pyq.year);
        }
      }
    }
  }

  return [...map.values()]
    .filter((stat) => stat.frequency > 0)
    .sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
      return a.topic.localeCompare(b.topic);
    });
}

export function unitWeightage(stats: TopicStat[], syllabus?: SyllabusUpload): { unit: string; marks: number; frequency: number }[] {
  const m = new Map<string, { marks: number; frequency: number }>();
  if (syllabus) {
    for (const u of syllabus.units) {
      m.set(canonicalUnitLabel(u.name) || u.name, { marks: 0, frequency: 0 });
    }
  }

  for (const s of stats) {
    const u = s.unit || "Unspecified";
    const cur = m.get(u) || { marks: 0, frequency: 0 };
    cur.marks += s.totalMarks;
    cur.frequency += s.frequency;
    m.set(u, cur);
  }
  return [...m.entries()]
    .map(([unit, v]) => ({ unit, ...v }))
    .sort((a, b) => {
      if (b.marks !== a.marks) return b.marks - a.marks;
      return a.unit.localeCompare(b.unit);
    });
}

export function repeatedQuestions(
  pyqs: PYQUpload[],
  topics?: { topic: string; unit?: string }[]
): { a: string; b: string; similarity: number; years: string[]; unit?: string; topic?: string }[] {
  const flat = pyqs.flatMap((p) => p.questions.map((q) => ({ ...q, year: p.year })));
  const pairs: { a: string; b: string; similarity: number; years: string[]; unit?: string; topic?: string }[] = [];
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      const sim = jaccard(flat[i].text, flat[j].text);
      if (sim >= 0.35 && flat[i].year !== flat[j].year) {
        let unit: string | undefined;
        let topicStr: string | undefined;
        if (topics && topics.length > 0) {
          const matches = matchQuestionToTopics(flat[i].text, topics);
          if (matches.length > 0) {
            unit = matches[0].unit;
            topicStr = matches[0].topic;
          }
        }
        pairs.push({
          a: flat[i].text,
          b: flat[j].text,
          similarity: Math.round(sim * 100),
          years: [flat[i].year, flat[j].year],
          unit,
          topic: topicStr,
        });
      }
    }
  }
  return pairs.sort((x, y) => y.similarity - x.similarity).slice(0, 25);
}

export function buildAnalysisSummary(
  pyqs: PYQUpload[],
  syllabus: SyllabusUpload | undefined,
  stats: TopicStat[]
): AnalysisSummary {
  const totalQuestions = pyqs.reduce((count, pyq) => count + pyq.questions.length, 0);
  const topicPool =
    syllabus && syllabus.units.length > 0
      ? syllabus.units.flatMap((unit) =>
          unit.topics
            .filter((topic) => isUsefulTopic(topic))
            .map((topic) => ({ topic, unit: canonicalUnitLabel(unit.name) }))
        )
      : stats.map((stat) => ({ topic: stat.topic, unit: stat.unit }));

  let matchedQuestions = 0;
  for (const pyq of pyqs) {
    for (const question of pyq.questions) {
      if (matchQuestionToTopics(question.text, topicPool).length > 0) {
        matchedQuestions += 1;
      }
    }
  }

  const units = unitWeightage(stats);
  return {
    totalQuestions,
    matchedQuestions,
    coveragePercent: totalQuestions === 0 ? 0 : Math.round((matchedQuestions / totalQuestions) * 100),
    syllabusTopics: topicPool.length,
    recurringTopics: stats.filter((stat) => stat.years.size >= 2).length,
    strongestUnit: units[0]?.unit ? canonicalUnitLabel(units[0].unit) : undefined,
  };
}

function jaccard(a: string, b: string): number {
  const A = new Set(normalize(a).split(" ").filter((w) => w.length > 3 && !STOPWORDS.has(w)));
  const B = new Set(normalize(b).split(" ").filter((w) => w.length > 3 && !STOPWORDS.has(w)));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return inter / union;
}

export function predict(stats: TopicStat[], totalYears: number): Prediction[] {
  if (stats.length === 0) return [];
  const maxFreq = Math.max(...stats.map((s) => s.frequency), 1);
  const maxMarks = Math.max(...stats.map((s) => s.totalMarks), 1);
  return stats
    .map((s) => {
      const freqScore = (s.frequency / maxFreq) * 50;
      const marksScore = (s.totalMarks / maxMarks) * 30;
      const consistencyScore = totalYears > 0 ? (s.years.size / totalYears) * 20 : 0;
      const score = Math.round(freqScore + marksScore + consistencyScore);
      const rationale = `Appeared ${s.frequency}× across ${s.years.size} year(s), worth ${s.totalMarks} total marks.`;
      return { topic: s.topic, unit: s.unit, score, rationale };
    })
    .sort((a, b) => b.score - a.score);
}

const STOPWORDS = new Set(
  "a an the and or of to in on for with by is are was were be been being this that these those it as at from which what who whom where when how why all any each every some such no not so than then there here their our your his her its also into more most other only own same too very can will just should now do does did has have had been you we they i".split(
    /\s+/
  )
);

function isUsefulTopic(topic: string): boolean {
  const cleaned = normalize(topic);
  if (!cleaned) return false;
  if (GENERIC_TOPIC_PATTERNS.some((pattern) => pattern.test(cleaned))) return false;

  const tokens = tokenize(topic);
  if (tokens.length === 0) return false;
  if (tokens.length === 1 && tokens[0].length < 5) return false;
  return true;
}

function canonicalUnitLabel(unit?: string): string | undefined {
  if (!unit) return undefined;
  const match = normalize(unit).match(/\b(?:unit|module|chapter)\s+([0-9ivx]+|[a-z])\b/i);
  if (!match) return unit;
  return `Unit ${match[1].toUpperCase()}`;
}

const GENERIC_TOPIC_PATTERNS = [
  /^general topics?$/,
  /^in this course$/,
  /^course outcomes?$/,
  /^learning outcomes?$/,
  /^(reference|text)?\s*books?$/,
  /^introduction$/,
  /^overview$/,
  /^basics?$/,
  /^applications?$/,
  /^model question paper$/,
  /\b(press|publication|published by|edition)\b/i,
  /^references?$/i,
  /^bibliography$/i,
  /^suggested readings?$/i,
  /author\s+/,
  /author:/,
];
