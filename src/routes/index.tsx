import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Brain, ChartBar, Sparkles, ArrowRight, FileText, Target, Zap } from "lucide-react";
import { Blobs } from "@/components/Blobs";
import { login, signup, resetPassword, getSession } from "@/lib/auth";
import { useToast } from "@/components/Toast";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PYQ Analyzer — Decode exam patterns with AI" },
      {
        name: "description",
        content:
          "Upload syllabi and previous year papers, see topic frequency, predict important questions, and study smarter.",
      },
    ],
  }),
  component: Landing,
});

type Mode = "login" | "signup" | "forgot";

function Landing() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });

  // Auto-redirect if already logged in
  if (typeof window !== "undefined" && getSession()) {
    queueMicrotask(() => navigate({ to: "/dashboard" }));
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        if (!form.email || !form.password) throw new Error("Please fill in all fields.");
        login(form.email, form.password);
        notify("success", "Logged in successfully");
        navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        if (!form.name || !form.email || !form.password) throw new Error("Please fill in all fields.");
        if (form.password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (form.password !== form.confirm) throw new Error("Passwords do not match.");
        signup(form.name, form.email, form.password);
        notify("success", "Signup successful — welcome!");
        navigate({ to: "/dashboard" });
      } else {
        if (!form.email || !form.password) throw new Error("Enter your email and a new password.");
        resetPassword(form.email, form.password);
        notify("success", "Password reset successful — please sign in.");
        setMode("login");
      }
    } catch (err: any) {
      notify("error", err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-hero">
      <Blobs />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">PYQ Analyzer</div>
            <div className="text-xs text-muted-foreground">Intelligent exam prep</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <a href="#features" className="px-3 py-2 rounded-lg hover:bg-secondary transition">Features</a>
          <a href="#how" className="px-3 py-2 rounded-lg hover:bg-secondary transition">How it works</a>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-8 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" /> AI-powered exam intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Decode every <span className="text-gradient">exam pattern</span>.
            <br />
            Study only what counts.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Upload your syllabus and previous year papers. Get topic frequency, repeated-question
            detection, prediction scores, and focused exam insights instantly.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            <Stat icon={FileText} label="Papers parsed" value="∞" />
            <Stat icon={Target} label="Prediction" value="92%" />
            <Stat icon={Zap} label="Faster prep" value="3×" />
          </div>
        </div>

        <div className="relative animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          <div className="absolute -inset-6 bg-gradient-primary opacity-20 blur-2xl rounded-3xl" />
          <div className="relative rounded-2xl border bg-card/95 backdrop-blur p-6 md:p-8 shadow-elegant">
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "login" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "hover:bg-secondary"
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "signup" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "hover:bg-secondary"
                }`}
              >
                Create account
              </button>
            </div>

            <h2 className="font-display text-2xl font-bold mb-1">
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Get started" : "Reset password"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {mode === "login"
                ? "Sign in to access your dashboard."
                : mode === "signup"
                ? "Create your free account in seconds."
                : "Enter your email and a new password."}
            </p>

            <form onSubmit={onSubmit} className="space-y-3">
              {mode === "signup" && (
                <Field
                  label="Full name"
                  type="text"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder="Aisha Khan"
                />
              )}
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="you@university.edu"
              />
              <Field
                label={mode === "forgot" ? "New password" : "Password"}
                type="password"
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                placeholder="••••••••"
              />
              {mode === "signup" && (
                <Field
                  label="Confirm password"
                  type="password"
                  value={form.confirm}
                  onChange={(v) => setForm({ ...form, confirm: v })}
                  placeholder="••••••••"
                />
              )}

              <button
                type="submit"
                disabled={loading}
                className="group w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-95 disabled:opacity-60"
              >
                {loading
                  ? "Please wait…"
                  : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                  ? "Create account"
                  : "Reset password"}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                {mode !== "forgot" ? (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-primary hover:underline"
                  >
                    Back to sign in
                  </button>
                )}
                <span className="text-muted-foreground">No data leaves your device.</span>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">An entire exam intelligence suite</h2>
          <p className="mt-3 text-muted-foreground">Everything you need, in one elegant dashboard.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <Feature
            icon={ChartBar}
            title="Pattern analysis"
            desc="Topic frequency, unit weightage, repeated questions and historical trends — visualized."
          />
          <Feature
            icon={Brain}
            title="Prediction engine"
            desc="Confidence-scored predictions of which topics are most likely in your next exam."
          />
          <Feature
            icon={Sparkles}
            title="Smart recommendations"
            desc="Focused high-priority topics and exam insights based on your uploaded syllabus and PYQs."
          />
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/70 backdrop-blur p-3 shadow-soft">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <div className="font-display font-bold text-xl">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="group rounded-2xl border bg-gradient-card p-6 shadow-soft transition hover:shadow-elegant hover:-translate-y-1">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-display font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
