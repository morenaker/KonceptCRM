"use client";
import { useEffect, useState } from "react";
import type { User } from "@/types";

export default function UsersClient({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "USER" as "ADMIN" | "USER",
  });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.error === "string" ? d.error : "Nepodařilo se vytvořit");
      return;
    }
    setForm({ email: "", name: "", password: "", role: "USER" });
    setCreating(false);
    await load();
  }

  async function handleRoleChange(id: string, role: "ADMIN" | "USER") {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await load();
  }

  async function handleResetPassword(id: string) {
    const pwd = prompt("Zadejte nové heslo (min. 6 znaků):");
    if (!pwd || pwd.length < 6) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    if (res.ok) alert("Heslo změněno.");
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Smazat uživatele ${email}?`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Smazání se nezdařilo");
      return;
    }
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Uživatelé</h1>
        <button onClick={() => setCreating(!creating)} className="btn-primary">
          {creating ? "Zrušit" : "+ Nový uživatel"}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-md border border-slate-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div>
            <label className="label">Jméno</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Heslo</label>
            <input
              type="password"
              minLength={6}
              className="input"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as any })
              }
            >
              <option value="USER">Uživatel</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {error && (
            <div className="sm:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">
              {error}
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end">
            <button className="btn-primary">Vytvořit</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-md border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="p-4 text-slate-500">Načítám…</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Jméno</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Vytvořeno</th>
                <th className="px-3 py-2 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      className="input max-w-[120px] py-1"
                      value={u.role}
                      disabled={u.id === currentUserId}
                      onChange={(e) =>
                        handleRoleChange(u.id, e.target.value as any)
                      }
                    >
                      <option value="USER">Uživatel</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleResetPassword(u.id)}
                      className="btn-ghost"
                    >
                      Reset hesla
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => handleDelete(u.id, u.email)}
                        className="btn-danger"
                      >
                        Smazat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
