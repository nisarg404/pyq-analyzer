import { useEffect, useState } from "react";
import { readDB, type Subject } from "@/lib/store";

export function SubjectPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  useEffect(() => {
    const refresh = () => setSubjects(readDB().subjects);
    refresh();
    window.addEventListener("pyq:db-change", refresh);
    return () => window.removeEventListener("pyq:db-change", refresh);
  }, []);
  if (subjects.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border bg-card px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    >
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}
