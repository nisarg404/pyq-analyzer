import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "warning";
type Toast = { id: string; kind: ToastKind; message: string };

const ToastCtx = createContext<{
  notify: (kind: ToastKind, message: string) => void;
}>({ notify: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => setToasts((s) => s.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(t);
  }, []);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }[toast.kind];
  const color = {
    success: "text-success border-success/30 bg-success/10",
    error: "text-destructive border-destructive/30 bg-destructive/10",
    info: "text-primary border-primary/30 bg-primary/10",
    warning: "text-warning border-warning/40 bg-warning/10",
  }[toast.kind];
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-card p-3 shadow-elegant transition-all ${
        show ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
      }`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 pt-1 text-sm text-foreground">{toast.message}</div>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
