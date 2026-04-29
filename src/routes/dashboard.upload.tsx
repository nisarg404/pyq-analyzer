import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, FileText, BookOpen, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { readDB, addPYQ, addSyllabus, type Subject } from "@/lib/store";
import { extractText, parseQuestions, parseSyllabus } from "@/lib/pdf";
import { useToast } from "@/components/Toast";

export const Route = createFileRoute("/dashboard/upload")({
  component: UploadCenter,
});

function UploadCenter() {
  const { notify } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const db = readDB();
      setSubjects(db.subjects);
      if (!activeSubject && db.subjects.length > 0) setActiveSubject(db.subjects[0].id);
      setTick((t) => t + 1);
    };
    refresh();
    window.addEventListener("pyq:db-change", refresh);
    return () => window.removeEventListener("pyq:db-change", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const db = readDB();
  const subjectPyqs = db.pyqs.filter((p) => p.subjectId === activeSubject);
  const subjectSyllabus = db.syllabi.find((s) => s.subjectId === activeSubject);

  return (
    <div className="space-y-6 animate-fade-in-up" key={tick}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Upload Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your syllabus and previous year papers. We parse them locally — nothing leaves your browser.
        </p>
      </div>

      {subjects.length === 0 ? (
        <EmptySubjects />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSubject(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                  activeSubject === s.id
                    ? "bg-gradient-primary text-primary-foreground border-transparent shadow-soft"
                    : "bg-card hover:bg-secondary"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <SyllabusUploadCard subjectId={activeSubject} notify={notify} existing={subjectSyllabus} />
            <PYQUploadCard subjectId={activeSubject} notify={notify} />
          </div>

          <UploadedPapers pyqs={subjectPyqs} />
        </>
      )}
    </div>
  );
}

function EmptySubjects() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-10 text-center">
      <BookOpen className="h-10 w-10 text-primary mx-auto mb-3" />
      <h3 className="font-display font-semibold text-lg">Add a subject first</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Use the sidebar to create a subject (e.g. "Operating Systems") and start uploading.
      </p>
    </div>
  );
}

function SyllabusUploadCard({
  subjectId,
  notify,
  existing,
}: {
  subjectId: string;
  notify: (k: any, m: string) => void;
  existing?: { fileName: string; units: { name: string; topics: string[] }[] };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", "Only PDF files are supported.");
      return;
    }
    setBusy(true);
    try {
      const text = await extractText(file);
      if (!text || text.length < 50) throw new Error("Could not read text from PDF (it may be scanned).");
      const units = parseSyllabus(text);
      addSyllabus({ subjectId, fileName: file.name, units });
      notify("success", `Syllabus parsed: ${units.length} unit(s) detected.`);
    } catch (e: any) {
      notify("error", e.message || "Failed to parse syllabus.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-2xl border bg-gradient-card p-6 shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display font-semibold">Syllabus</h3>
          <p className="text-xs text-muted-foreground">PDF only · Auto-extracts units & topics</p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/40"
        }`}
      >
        <Upload className="h-7 w-7 mx-auto text-primary mb-2" />
        <div className="font-medium text-sm">{busy ? "Parsing…" : "Drop syllabus PDF or click to browse"}</div>
        <div className="text-xs text-muted-foreground mt-1">Max 1 file · replaces existing</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {existing && (
        <div className="mt-4 rounded-lg border bg-success/5 border-success/30 p-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="font-medium truncate">{existing.fileName}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {existing.units.length} units
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PYQUploadCard({ subjectId, notify }: { subjectId: string; notify: (k: any, m: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [examType, setExamType] = useState("End-Sem");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const handleFile = async (file: File) => {
    if (!year.trim()) {
      notify("error", "Please enter the year.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", "Only PDF files are supported.");
      return;
    }
    setBusy(true);
    try {
      const text = await extractText(file);
      if (!text || text.length < 50) throw new Error("Could not read text from PDF (it may be scanned).");
      const questions = parseQuestions(text);
      if (questions.length === 0) throw new Error("No questions detected in the PDF.");
      addPYQ({ subjectId, fileName: file.name, year: year.trim(), examType, questions });
      notify("success", `Parsed ${questions.length} questions from ${file.name}.`);
    } catch (e: any) {
      notify("error", e.message || "Failed to parse paper.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-2xl border bg-gradient-card p-6 shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display font-semibold">Previous Year Paper</h3>
          <p className="text-xs text-muted-foreground">PDF only · Set year & exam type</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Year</span>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Exam type</span>
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option>End-Sem</option>
            <option>Mid-Sem</option>
            <option>Quiz</option>
            <option>Supplementary</option>
            <option>Other</option>
          </select>
        </label>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
          drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/40"
        }`}
      >
        <Upload className="h-7 w-7 mx-auto text-primary mb-2" />
        <div className="font-medium text-sm">{busy ? "Parsing…" : "Drop paper PDF or click to browse"}</div>
        <div className="text-xs text-muted-foreground mt-1">Add multiple — one per year</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}

function UploadedPapers({ pyqs }: { pyqs: any[] }) {
  if (pyqs.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          No papers uploaded for this subject yet.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <h3 className="font-display font-semibold mb-4">Uploaded papers ({pyqs.length})</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pyqs
          .sort((a, b) => b.year.localeCompare(a.year))
          .map((p) => (
            <div key={p.id} className="rounded-xl border bg-background p-4 hover:border-primary/40 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                  {p.year}
                </span>
                <span className="text-xs text-muted-foreground">{p.examType}</span>
              </div>
              <div className="text-sm font-medium truncate" title={p.fileName}>
                {p.fileName}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{p.questions.length} questions</div>
            </div>
          ))}
      </div>
    </div>
  );
}
