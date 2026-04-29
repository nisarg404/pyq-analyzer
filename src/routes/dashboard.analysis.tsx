import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { readDB } from "@/lib/store";
import { buildAnalysisSummary, computeTopicStats, repeatedQuestions, unitWeightage } from "@/lib/analysis";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Repeat, ChartBar, BookOpen, Files, Target, BadgeCheck, Layers3 } from "lucide-react";
import { SubjectPicker } from "@/components/SubjectPicker";

export const Route = createFileRoute("/dashboard/analysis")({
  component: AnalysisPage,
});

const COLORS = [
  "oklch(0.55 0.22 265)",
  "oklch(0.7 0.2 320)",
  "oklch(0.72 0.18 200)",
  "oklch(0.78 0.16 75)",
  "oklch(0.68 0.17 155)",
];

function AnalysisPage() {
  const [tick, setTick] = useState(0);
  const [subjectId, setSubjectId] = useState<string>("");
  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    window.addEventListener("pyq:db-change", f);
    return () => window.removeEventListener("pyq:db-change", f);
  }, []);

  const db = readDB();
  const subj = db.subjects.find((s) => s.id === subjectId) || db.subjects[0];

  const { stats, topStats, units, repeats, summary, recurringTopics, chartUnits } = useMemo(() => {
    if (!subj) return { stats: [], topStats: [], units: [], repeats: [], summary: null, recurringTopics: [], chartUnits: [] };
    const subjPyqs = db.pyqs.filter((p) => p.subjectId === subj.id);
    const syl = db.syllabi.find((s) => s.subjectId === subj.id);
    const stats = computeTopicStats(subjPyqs, syl);
    const topStats = stats.slice(0, 12);
    const units = unitWeightage(stats, syl);
    
    // Calculate percentages so they sum to ~100
    const totalMarks = units.reduce((acc, u) => acc + u.marks, 0);
    const chartUnits = units.map((u) => {
      const pct = totalMarks > 0 ? Math.round((u.marks / totalMarks) * 100) : 0;
      // Force a minimum display value of 1 so the unit ALWAYS appears as a tiny slice in the circle
      const displayValue = pct === 0 ? 1 : pct;
      return { ...u, percentage: pct, displayValue };
    });

    const repeats = repeatedQuestions(subjPyqs, stats);
    const summary = buildAnalysisSummary(subjPyqs, syl, stats);
    const recurringTopics = stats.filter(s => s.years.size >= 2).sort((a,b) => b.frequency - a.frequency);
    return { stats, topStats, units, repeats, summary, recurringTopics, chartUnits };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, tick, db.subjects.length]);

  if (!subj) return <EmptyState message="Add a subject and upload papers to see analysis." />;

  return (
    <div className="space-y-6 animate-fade-in-up" key={tick}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pattern Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">Topic frequency, unit weightage and repeated questions.</p>
        </div>
        <SubjectPicker value={subj.id} onChange={setSubjectId} />
      </div>

      {stats.length === 0 ? (
        <EmptyState message="Upload at least one PYQ paper for this subject." />
      ) : (
        <>
          {summary && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <InsightCard icon={Files} label="Questions analyzed" value={summary.totalQuestions} />
              <InsightCard icon={Target} label="Matched to syllabus" value={`${summary.coveragePercent}%`} />
              <InsightCard icon={BadgeCheck} label="Recurring topics" value={summary.recurringTopics} />
              <InsightCard icon={Layers3} label="Strongest unit" value={summary.strongestUnit || "Unspecified"} />
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            <Card title="Top topic frequency" icon={ChartBar}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topStats.map((s) => ({ name: shorten(s.topic), freq: s.frequency, marks: s.totalMarks }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="freq" radius={[6, 6, 0, 0]} fill="oklch(0.55 0.22 265)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Unit-wise marks weightage" icon={BookOpen}>
              {units.length === 0 || units.every((u) => u.marks === 0) ? (
                <p className="text-sm text-muted-foreground">No marks data — try uploading more papers.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartUnits}
                      dataKey="displayValue"
                      nameKey="unit"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      labelLine={false}
                    >
                      {chartUnits.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={tooltipStyle} 
                      formatter={(_value, name, props) => [`${props.payload.percentage}% (${props.payload.marks} marks)`, name]} 
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <h3 className="font-display font-semibold mb-1">Top topic stats</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Only the most frequently asked syllabus topics are shown.
            </p>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4">Topic</th>
                    <th className="py-2 pr-4">Unit</th>
                    <th className="py-2 pr-4 text-right">Frequency</th>
                    <th className="py-2 pr-4 text-right">Avg. Marks / Yr</th>
                    <th className="py-2 pr-4 text-right">Years</th>
                  </tr>
                </thead>
                <tbody>
                  {topStats.map((s) => (
                    <tr key={s.topic} className="border-b last:border-0 hover:bg-secondary/40">
                      <td className="py-2 pr-4 font-medium">{s.topic}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{s.unit || "—"}</td>
                      <td className="py-2 pr-4 text-right">{s.frequency}</td>
                      <td className="py-2 pr-4 text-right">{Math.round(s.totalMarks / Math.max(s.years.size, 1))}</td>
                      <td className="py-2 pr-4 text-right">{s.years.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <BadgeCheck className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold">Recurring Topics</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Topics that have appeared in multiple years.
            </p>
            {recurringTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recurring topics found yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-4">Topic</th>
                      <th className="py-2 pr-4">Unit</th>
                      <th className="py-2 pr-4 text-right">Frequency</th>
                      <th className="py-2 pr-4 text-right">Avg. Marks / Yr</th>
                      <th className="py-2 pr-4 text-right">Years Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringTopics.map((s) => (
                      <tr key={`rec-${s.topic}`} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="py-2 pr-4 font-medium text-primary">{s.topic}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">{s.unit || "—"}</td>
                        <td className="py-2 pr-4 text-right font-medium">{s.frequency}</td>
                        <td className="py-2 pr-4 text-right">{Math.round(s.totalMarks / Math.max(s.years.size, 1))}</td>
                        <td className="py-2 pr-4 text-right">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {s.years.size} years
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 mb-1">
              <Repeat className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold">Repeated / similar questions</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {repeats.length} pair(s) detected with ≥35% similarity across years.
            </p>
            {repeats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No repeated questions found yet.</p>
            ) : (
              <div className="space-y-3">
                {repeats.slice(0, 8).map((r, i) => (
                  <div key={i} className="rounded-xl border p-4 bg-background">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {r.similarity}% match
                      </span>
                      {r.unit && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border">
                          {r.unit}{r.topic ? `: ${r.topic}` : ""}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Years: {r.years.join(" ↔ ")}
                      </span>
                    </div>
                    <p className="text-sm mb-1.5"><span className="font-semibold text-muted-foreground">A:</span> {r.a.slice(0, 220)}…</p>
                    <p className="text-sm"><span className="font-semibold text-muted-foreground">B:</span> {r.b.slice(0, 220)}…</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function shorten(t: string, n = 22) {
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function InsightCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4 text-primary" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold leading-none">{value}</div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-gradient-card p-6 shadow-soft">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: "oklch(1 0 0)",
  border: "1px solid oklch(0.92 0.015 255)",
  borderRadius: 8,
  fontSize: 12,
};

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
