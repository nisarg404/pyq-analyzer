import { createFileRoute, Outlet, Link, useNavigate, useLocation, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Menu,
  LogOut,
  LayoutDashboard,
  Upload,
  BarChart3,
  Brain,
  FileDown,
} from "lucide-react";
import { getSession, logout } from "@/lib/auth";
import { addSubject, deleteSubject, readDB, type Subject } from "@/lib/store";
import { useToast } from "@/components/Toast";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getSession()) {
      throw redirect({ to: "/" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const session = getSession();

  useEffect(() => {
    const refresh = () => setSubjects(readDB().subjects);
    refresh();
    window.addEventListener("pyq:db-change", refresh);
    return () => window.removeEventListener("pyq:db-change", refresh);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSubject.trim();
    if (!name) return;
    try {
      addSubject(name);
      setNewSubject("");
      notify("success", `Added subject: ${name}`);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleDelete = (s: Subject) => {
    if (!confirm(`Delete "${s.name}" and all its data?`)) return;
    deleteSubject(s.id);
    notify("info", `Deleted ${s.name}`);
  };

  const handleLogout = () => {
    logout();
    notify("info", "Logged out");
    navigate({ to: "/" });
  };

  const navItems = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/dashboard/upload", label: "Upload Center", icon: Upload },
    { to: "/dashboard/analysis", label: "Pattern Analysis", icon: BarChart3 },
    { to: "/dashboard/predictions", label: "Predictions", icon: Brain },
    { to: "/dashboard/reports", label: "Reports", icon: FileDown },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen bg-gradient-sidebar text-sidebar-foreground shadow-elegant transition-all duration-300 ease-out flex flex-col
          ${collapsed ? "w-[76px]" : "w-[280px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-display font-bold text-base leading-tight">PYQ Analyzer</div>
              <div className="text-[11px] text-sidebar-foreground/60">PYQ Intelligence</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sidebar-accent transition"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {isActive && !collapsed && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-glow" />
                )}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="px-4 py-3 border-t border-sidebar-border">
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 mb-2">
              Subjects
            </div>
            <form onSubmit={handleAdd} className="flex gap-1.5 mb-3">
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Add subject…"
                className="flex-1 min-w-0 rounded-md bg-sidebar-accent/60 border border-sidebar-border px-2.5 py-1.5 text-sm placeholder:text-sidebar-foreground/40 outline-none focus:border-primary-glow"
              />
              <button
                type="submit"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground hover:opacity-90 transition"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
            <div className="space-y-1 max-h-[34vh] overflow-y-auto pr-1">
              {subjects.length === 0 && (
                <p className="text-xs text-sidebar-foreground/50 px-1">No subjects yet.</p>
              )}
              {subjects.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent/60 transition"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-glow shrink-0" />
                  <span className="truncate flex-1">{s.name}</span>
                  <button
                    onClick={() => handleDelete(s)}
                    className="opacity-0 group-hover:opacity-100 text-sidebar-foreground/60 hover:text-destructive transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto px-3 py-3 border-t border-sidebar-border">
          {!collapsed && session && (
            <div className="px-2 pb-2">
              <div className="text-sm font-medium truncate">{session.name}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{session.email}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-destructive/20 hover:text-sidebar-foreground transition"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/80 backdrop-blur px-4 lg:px-8 py-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg border hover:bg-secondary"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="text-sm text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{session?.name?.split(" ")[0] || "Student"}</span>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            All systems operational
          </div>
        </header>
        <main className="flex-1 px-4 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
