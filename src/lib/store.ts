// Per-user data store (subjects, uploads, and analyses) backed by localStorage.
import { getSession } from "./auth";

export type Subject = {
  id: string;
  name: string;
  createdAt: number;
};

export type Question = {
  text: string;
  marks: number;
  unit?: string;
  topic?: string;
};

export type PYQUpload = {
  id: string;
  subjectId: string;
  fileName: string;
  year: string;
  examType: string;
  uploadedAt: number;
  questions: Question[];
};

export type SyllabusUpload = {
  id: string;
  subjectId: string;
  fileName: string;
  uploadedAt: number;
  units: { name: string; topics: string[] }[];
};

type DB = {
  subjects: Subject[];
  pyqs: PYQUpload[];
  syllabi: SyllabusUpload[];
};

const empty: DB = { subjects: [], pyqs: [], syllabi: [] };

function key() {
  const s = getSession();
  return s ? `pyq.db.${s.id}` : "pyq.db.guest";
}

export function readDB(): DB {
  if (typeof window === "undefined") return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(key()) || "{}") };
  } catch {
    return empty;
  }
}

export function writeDB(db: DB) {
  localStorage.setItem(key(), JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("pyq:db-change"));
}

export function addSubject(name: string): Subject {
  const db = readDB();
  if (db.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Subject already exists.");
  }
  const subj: Subject = { id: crypto.randomUUID(), name, createdAt: Date.now() };
  db.subjects.push(subj);
  writeDB(db);
  return subj;
}

export function deleteSubject(id: string) {
  const db = readDB();
  db.subjects = db.subjects.filter((s) => s.id !== id);
  db.pyqs = db.pyqs.filter((p) => p.subjectId !== id);
  db.syllabi = db.syllabi.filter((s) => s.subjectId !== id);
  writeDB(db);
}

export function addPYQ(p: Omit<PYQUpload, "id" | "uploadedAt">): PYQUpload {
  const db = readDB();
  const dup = db.pyqs.find(
    (x) => x.subjectId === p.subjectId && x.year === p.year && x.examType === p.examType && x.fileName === p.fileName
  );
  if (dup) throw new Error("This paper has already been uploaded.");
  const item: PYQUpload = { ...p, id: crypto.randomUUID(), uploadedAt: Date.now() };
  db.pyqs.push(item);
  writeDB(db);
  return item;
}

export function addSyllabus(s: Omit<SyllabusUpload, "id" | "uploadedAt">): SyllabusUpload {
  const db = readDB();
  // Replace existing syllabus for the same subject
  db.syllabi = db.syllabi.filter((x) => x.subjectId !== s.subjectId);
  const item: SyllabusUpload = { ...s, id: crypto.randomUUID(), uploadedAt: Date.now() };
  db.syllabi.push(item);
  writeDB(db);
  return item;
}
