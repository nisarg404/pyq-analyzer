// Mock auth backed by localStorage. Designed to be swapped for real backend later.
export type User = { id: string; name: string; email: string };

const USERS_KEY = "pyq.users";
const SESSION_KEY = "pyq.session";

type StoredUser = User & { password: string };

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function signup(name: string, email: string, password: string): User {
  const users = readUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    password,
  };
  users.push(user);
  writeUsers(users);
  const session: User = { id: user.id, name: user.name, email: user.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function login(email: string, password: string): User {
  const users = readUsers();
  const u = users.find(
    (x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password
  );
  if (!u) throw new Error("Invalid credentials. Please try again.");
  const session: User = { id: u.id, name: u.name, email: u.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function resetPassword(email: string, newPassword: string) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) throw new Error("No account found with that email.");
  users[idx].password = newPassword;
  writeUsers(users);
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
