import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { readDB } from "@/lib/store";
import { computeTopicStats, predict } from "@/lib/analysis";
import { SubjectPicker } from "@/components/SubjectPicker";
import { EmptyState } from "./dashboard.analysis";
import { Brain, Flame, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard/predictions")({
  component: PredictionsPage,
});

function PredictionsPage() {
  const [tick, setTick] = useState(0);
  const [subjectId, setSubjectId] = useState<string>("");
  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    window.addEventListener("pyq:db-change", f);
    return () => window.removeEventListener("pyq:db-change", f);
  }, []);

  const db = readDB();
  const subj = db.subjects.find((s) => s.id === subjectId) || db.subjects[0];

  const predictions = useMemo(() => {
    if (!subj) return [];
    const subjPyqs = db.pyqs.filter((p) => p.subjectId === subj.id);
    const syl = db.syllabi.find((s) => s.subjectId === subj.id);
    const stats = computeTopicStats(subjPyqs, syl);
    return predict(stats, new Set(subjPyqs.map((p) => p.year)).size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, tick, db.subjects.length]);

  if (!subj) return <EmptyState message="Add a subject to see predictions." />;

  return (
    <div className="space-y-6 animate-fade-in-up" key={tick}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" /> Predictions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Confidence-scored topics most likely to appear in your next exam.
          </p>
        </div>
        <SubjectPicker value={subj.id} onChange={setSubjectId} />
      </div>

      {predictions.length === 0 ? (
        <EmptyState message="Upload PYQ papers to generate predictions." />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {predictions.slice(0, 18).map((p, i) => (
            <PredictionCard key={p.topic} rank={i + 1} {...p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionCard({
  rank,
  topic,
  unit,
  score,
  rationale,
}: {
  rank: number;
  topic: string;
  unit?: string;
  score: number;
  rationale: string;
}) {
  const tier =
    score >= 75 ? { label: "Critical", c: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: Flame }
    : score >= 50 ? { label: "High", c: "text-warning", bg: "bg-warning/10 border-warning/40", icon: Sparkles }
    : { label: "Moderate", c: "text-primary", bg: "bg-primary/10 border-primary/30", icon: Sparkles };
  const Icon = tier.icon;
  return (
    <div className={`rounded-2xl border p-5 shadow-soft transition hover:shadow-elegant hover:-translate-y-0.5 ${tier.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground">#{rank}</span>
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${tier.c}`}>
          <Icon className="h-3.5 w-3.5" /> {tier.label}
        </div>
      </div>
      <h3 className="font-display font-semibold leading-tight mb-1">{topic}</h3>
      {unit && <p className="text-xs text-muted-foreground mb-3">{unit}</p>}
      <div className="mt-3">
        <div className="flex items-end justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</span>
          <span className="font-display font-bold text-lg">{score}<span className="text-xs text-muted-foreground">/100</span></span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-gradient-primary rounded-full transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{rationale}</p>
    </div>
  );
}
