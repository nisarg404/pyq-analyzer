import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { readDB } from "@/lib/store";
import { computeTopicStats, predict, unitWeightage } from "@/lib/analysis";
import { SubjectPicker } from "@/components/SubjectPicker";
import { EmptyState } from "./dashboard.analysis";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { useToast } from "@/components/Toast";
import jsPDF from "jspdf";

export const Route = createFileRoute("/dashboard/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { notify } = useToast();
  const [subjectId, setSubjectId] = useState<string>("");
  const db = readDB();
  const subj = db.subjects.find((s) => s.id === subjectId) || db.subjects[0];

  if (!subj) return <EmptyState message="Add a subject to generate reports." />;

  const subjPyqs = db.pyqs.filter((p) => p.subjectId === subj.id);
  const syl = db.syllabi.find((s) => s.subjectId === subj.id);
  const stats = computeTopicStats(subjPyqs, syl);
  const preds = predict(stats, new Set(subjPyqs.map((p) => p.year)).size);
  const units = unitWeightage(stats);

  const exportPDF = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 40;
      let y = margin;
      const pageH = doc.internal.pageSize.getHeight();
      const ensure = (h: number) => {
        if (y + h > pageH - margin) { doc.addPage(); y = margin; }
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(`PYQ Analysis Report — ${subj.name}`, margin, y);
      y += 24;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
      y += 18;
      doc.setTextColor(0);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Summary", margin, y); y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = [
        `Papers analyzed: ${subjPyqs.length}`,
        `Questions parsed: ${subjPyqs.reduce((a, p) => a + p.questions.length, 0)}`,
        `Topics tracked: ${stats.length}`,
      ];
      for (const l of lines) { ensure(14); doc.text(l, margin, y); y += 14; }
      y += 6;

      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      ensure(20); doc.text("Top predictions", margin, y); y += 16;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      for (const p of preds.slice(0, 15)) {
        ensure(28);
        doc.setFont("helvetica", "bold");
        const text = `${p.topic}  —  ${p.score}/100`;
        doc.text(text, margin, y); y += 12;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        const wrapped = doc.splitTextToSize(p.rationale, 515);
        doc.text(wrapped, margin, y); y += wrapped.length * 12 + 4;
        doc.setTextColor(0);
      }

      doc.addPage(); y = margin;
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Unit-wise weightage", margin, y); y += 16;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      for (const u of units) {
        ensure(14);
        doc.text(`${u.unit}  —  ${u.frequency} questions, ${u.marks} marks`, margin, y); y += 14;
      }
      y += 10;

      doc.save(`${subj.name.replace(/\s+/g, "_")}_PYQ_Report.pdf`);
      notify("success", "PDF report downloaded");
    } catch (e: any) {
      notify("error", e.message || "Failed to generate PDF");
    }
  };

  const exportCSV = () => {
    try {
      const rows = [
        ["Topic", "Unit", "Frequency", "Total Marks", "Years", "Prediction Score"],
        ...stats.map((s) => {
          const p = preds.find((x) => x.topic === s.topic);
          return [s.topic, s.unit || "", s.frequency, s.totalMarks, s.years.size, p?.score || 0];
        }),
      ];
      const csv = rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${subj.name.replace(/\s+/g, "_")}_topics.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify("success", "CSV downloaded");
    } catch (e: any) {
      notify("error", e.message || "Failed to export CSV");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileDown className="h-7 w-7 text-primary" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Export comprehensive analysis, predictions, and unit weightage.
          </p>
        </div>
        <SubjectPicker value={subj.id} onChange={setSubjectId} />
      </div>

      {subjPyqs.length === 0 ? (
        <EmptyState message="Upload PYQ papers to enable report generation." />
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          <ReportCard
            icon={FileText}
            title="Full PDF Report"
            desc="A printable subject summary with predictions and unit-wise weightage."
            onClick={exportPDF}
            cta="Download PDF"
          />
          <ReportCard
            icon={FileSpreadsheet}
            title="Topics CSV"
            desc="Spreadsheet of every tracked topic with frequency, marks, and prediction score."
            onClick={exportCSV}
            cta="Download CSV"
          />
        </div>
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h3 className="font-display font-semibold mb-3">Live preview</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <Preview label="Papers" value={subjPyqs.length} />
          <Preview label="Topics" value={stats.length} />
          <Preview label="Predictions" value={preds.length} />
          <Preview label="Units tracked" value={units.length} />
        </div>
      </div>
    </div>
  );
}

function ReportCard({ icon: Icon, title, desc, onClick, cta }: any) {
  return (
    <div className="rounded-2xl border bg-gradient-card p-6 shadow-soft transition hover:shadow-elegant">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-display font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5">{desc}</p>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95 transition"
      >
        <FileDown className="h-4 w-4" /> {cta}
      </button>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
