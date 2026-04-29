import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { readDB } from "@/lib/store";
import { FileText, BookCheck, Layers, TrendingUp, Upload, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  component: Overview,
});

function Overview() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    window.addEventListener("pyq:db-change", f);
    return () => window.removeEventListener("pyq:db-change", f);
  }, []);

  const db = readDB();
  const totalQuestions = db.pyqs.reduce((acc, p) => acc + p.questions.length, 0);
  const totalMarks = db.pyqs.reduce(
    (acc, p) => acc + p.questions.reduce((s, q) => s + (q.marks || 0), 0),
    0
  );
  return (
    <div className="space-y-6 animate-fade-in-up" key={tick}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A bird's-eye view of your exam preparation across all subjects.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={BookCheck} label="Subjects" value={db.subjects.length} accent="primary" />
        <KpiCard icon={FileText} label="Papers uploaded" value={db.pyqs.length} accent="accent" />
        <KpiCard icon={Layers} label="Questions parsed" value={totalQuestions} accent="primary" />
        <KpiCard icon={TrendingUp} label="Marks mapped" value={totalMarks} accent="accent" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border bg-gradient-card p-6 shadow-soft">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold text-lg">Analysis snapshot</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                A quick summary of how much exam data has already been mapped.
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <SnapshotCard
              label="Subjects with syllabus"
              value={db.syllabi.length}
              helper="Subjects already mapped to structured topics."
            />
            <SnapshotCard
              label="Papers analyzed"
              value={db.pyqs.length}
              helper="Uploaded PYQs feeding the analysis engine."
            />
            <SnapshotCard
              label="Questions parsed"
              value={totalQuestions}
              helper="Detected questions available for pattern analysis."
            />
          </div>
        </div>

        <div className="rounded-2xl border bg-gradient-card p-6 shadow-soft">
          <h2 className="font-display font-semibold text-lg mb-1">Quick actions</h2>
          <p className="text-sm text-muted-foreground mb-5">Jump into the next step.</p>
          <div className="space-y-2">
            <ActionLink to="/dashboard/upload" icon={Upload} label="Upload papers" />
            <ActionLink to="/dashboard/analysis" icon={TrendingUp} label="View analysis" />
            <ActionLink to="/dashboard/predictions" icon={Sparkles} label="See predictions" />
            <ActionLink to="/dashboard/reports" icon={FileText} label="Export reports" />
          </div>
        </div>
      </div>

      {db.subjects.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
          <h3 className="font-display font-semibold text-lg">Start by adding a subject</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Use the sidebar input on the left to add your first subject.
          </p>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent: "primary" | "accent";
}) {
  const ring =
    accent === "primary"
      ? "from-primary/20 to-primary-glow/10 text-primary"
      : "from-accent/20 to-accent/5 text-accent";
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft transition hover:shadow-elegant hover:-translate-y-0.5">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${ring} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function ActionLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-sm hover:border-primary/40 hover:bg-primary/5 transition"
    >
      <Icon className="h-4 w-4 text-primary" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
    </Link>
  );
}

function SnapshotCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number | string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-2">{helper}</div>
    </div>
  );
}
