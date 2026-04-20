"use client";
import { useEffect, useState } from "react";
import { CATEGORIES, STAGES, ACTIVITY_TYPES, activityTypeLabel } from "@/lib/constants";
import type { Activity, Company } from "@/types";

type Props = {
  company: Company | null; // null = create mode
  open: boolean;
  onClose: () => void;
  onSaved: (c: Company) => void;
  onDeleted: (id: string) => void;
};

function toDateInput(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function buildNotesWithAres(
  existing: string,
  data: {
    address: string | null;
    legalForm: string | null;
    dic: string | null;
    foundedAt: string | null;
    employees: { label: string | null };
    turnover: { label: string | null };
  }
): string {
  const MARKER_START = "--- ARES ---";
  const MARKER_END = "--- /ARES ---";
  const lines: string[] = [MARKER_START];
  if (data.address) lines.push(`Adresa: ${data.address}`);
  if (data.legalForm) lines.push(`Právní forma: ${data.legalForm}`);
  if (data.dic) lines.push(`DIČ: ${data.dic}`);
  if (data.foundedAt)
    lines.push(`Datum vzniku: ${new Date(data.foundedAt).toLocaleDateString("cs-CZ")}`);
  if (data.employees?.label) lines.push(`Počet zaměstnanců: ${data.employees.label}`);
  if (data.turnover?.label) lines.push(`Obrat: ${data.turnover.label}`);
  lines.push(MARKER_END);
  const block = lines.join("\n");
  const without = existing.replace(
    new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`),
    ""
  );
  return (without.trim() ? without.trim() + "\n\n" : "") + block;
}

export default function CompanyModal({
  company,
  open,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const isEdit = !!company;
  const [form, setForm] = useState({
    name: "",
    ico: "",
    web: "",
    contactPerson: "",
    phone: "",
    email: "",
    category: "TECHNICAL",
    stage: "NEW",
    notes: "",
    followUpDate: "",
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityForm, setActivityForm] = useState({ type: "CALL", note: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aresLoading, setAresLoading] = useState(false);
  const [aresError, setAresError] = useState<string | null>(null);
  const [aresInfo, setAresInfo] = useState<{
    name: string | null;
    legalForm: string | null;
    dic: string | null;
    address: string | null;
    foundedAt: string | null;
    employees: { code: string | null; label: string | null };
    turnover: { code: string | null; label: string | null };
  } | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    score: number;
    verdict: string;
    reasoning: string;
    recommendations: string[];
    email: { subject: string; body: string };
  } | null>(null);
  const [aiAnalysisAt, setAiAnalysisAt] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (company) {
      setForm({
        name: company.name,
        ico: company.ico ?? "",
        web: company.web ?? "",
        contactPerson: company.contactPerson ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        category: company.category,
        stage: company.stage,
        notes: company.notes ?? "",
        followUpDate: toDateInput(company.followUpDate),
      });
      // load activities
      fetch(`/api/companies/${company.id}/activities`)
        .then((r) => r.json())
        .then(setActivities)
        .catch(() => setActivities([]));
    } else {
      setForm({
        name: "",
        ico: "",
        web: "",
        contactPerson: "",
        phone: "",
        email: "",
        category: "TECHNICAL",
        stage: "NEW",
        notes: "",
        followUpDate: "",
      });
      setActivities([]);
    }
    setAresInfo(null);
    setAresError(null);
    setAiError(null);
    setEmailCopied(false);
    if (company?.aiAnalysis) {
      try {
        setAiResult(JSON.parse(company.aiAnalysis));
        setAiAnalysisAt(company.aiAnalysisAt ?? null);
      } catch {
        setAiResult(null);
        setAiAnalysisAt(null);
      }
    } else {
      setAiResult(null);
      setAiAnalysisAt(null);
    }
  }, [company, open]);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...form,
        followUpDate: form.followUpDate || null,
      };
      const res = await fetch(
        isEdit ? `/api/companies/${company!.id}` : "/api/companies",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          typeof d.error === "string" ? d.error : "Uložení se nezdařilo"
        );
      }
      const saved = await res.json();
      onSaved(saved);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm(`Opravdu smazat firmu „${company!.name}"? Tato akce je nevratná.`))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${company!.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Smazání se nezdařilo");
      onDeleted(company!.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadAres() {
    const ico = form.ico.replace(/\s+/g, "");
    if (!/^\d{6,8}$/.test(ico)) {
      setAresError("Zadej platné IČO (6–8 číslic).");
      return;
    }
    setAresLoading(true);
    setAresError(null);
    setAresInfo(null);
    try {
      const res = await fetch(`/api/ares/${ico}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "ARES se nepodařilo načíst.");
      setAresInfo(data);
      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() ? prev.name : data.name ?? prev.name,
        ico: data.ico ?? prev.ico,
        notes: buildNotesWithAres(prev.notes, data),
      }));
    } catch (e: any) {
      setAresError(e.message);
    } finally {
      setAresLoading(false);
    }
  }

  async function handleAiAnalysis() {
    if (!isEdit || !company) return;
    setAiLoading(true);
    setAiError(null);
    setEmailCopied(false);
    try {
      const res = await fetch(`/api/companies/${company.id}/ai-analysis`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "AI analýza selhala.");
      setAiResult(data);
      setAiAnalysisAt(data.aiAnalysisAt ?? new Date().toISOString());
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleDeleteAiAnalysis() {
    if (!isEdit || !company) return;
    if (!confirm("Smazat uloženou AI analýzu?")) return;
    const res = await fetch(`/api/companies/${company.id}/ai-analysis`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAiResult(null);
      setAiAnalysisAt(null);
    }
  }

  async function handleCopyEmail() {
    if (!aiResult) return;
    const text = `Předmět: ${aiResult.email.subject}\n\n${aiResult.email.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      setEmailCopied(false);
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit) return;
    const res = await fetch(`/api/companies/${company!.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activityForm),
    });
    if (res.ok) {
      const a = await res.json();
      setActivities((prev) => [a, ...prev]);
      setActivityForm({ type: "CALL", note: "" });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8 max-h-[calc(100vh-4rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Upravit firmu" : "Nová firma"}
          </h2>
          <button onClick={onClose} className="btn-ghost" aria-label="Zavřít">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Název firmy *</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">IČO</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={form.ico}
                  onChange={(e) => setForm({ ...form, ico: e.target.value })}
                  placeholder="8 číslic"
                />
                <button
                  type="button"
                  onClick={handleLoadAres}
                  className="btn-secondary whitespace-nowrap"
                  disabled={aresLoading || !form.ico.trim()}
                  title="Načíst základní info, počet zaměstnanců a kategorii obratu z ARES"
                >
                  {aresLoading ? "Načítám…" : "Načíst z ARES"}
                </button>
              </div>
              {aresError && (
                <div className="text-xs text-red-600 mt-1">{aresError}</div>
              )}
            </div>
            <div>
              <label className="label">Web</label>
              <input
                className="input"
                type="url"
                placeholder="https://www.priklad.cz"
                value={form.web}
                onChange={(e) => setForm({ ...form, web: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Kontaktní osoba</label>
              <input
                className="input"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm({ ...form, contactPerson: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Kategorie *</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fáze *</label>
              <select
                className="input"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Follow-up</label>
              <input
                className="input"
                type="date"
                value={form.followUpDate}
                onChange={(e) =>
                  setForm({ ...form, followUpDate: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Poznámky</label>
              <textarea
                className="input min-h-[80px]"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {aresInfo && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <div className="font-semibold mb-1">Načteno z ARES</div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {aresInfo.name && (
                  <div>
                    <dt className="inline text-slate-500">Název: </dt>
                    <dd className="inline">{aresInfo.name}</dd>
                  </div>
                )}
                {aresInfo.legalForm && (
                  <div>
                    <dt className="inline text-slate-500">Právní forma: </dt>
                    <dd className="inline">{aresInfo.legalForm}</dd>
                  </div>
                )}
                {aresInfo.address && (
                  <div className="sm:col-span-2">
                    <dt className="inline text-slate-500">Adresa: </dt>
                    <dd className="inline">{aresInfo.address}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline text-slate-500">Počet zaměstnanců: </dt>
                  <dd className="inline">
                    {aresInfo.employees.label ?? "Neuvedeno v ARES"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Obrat (kategorie): </dt>
                  <dd className="inline">
                    {aresInfo.turnover.label ?? "Neuvedeno v ARES"}
                  </dd>
                </div>
              </dl>
              <div className="text-xs text-slate-500 mt-2">
                ARES uvádí pouze rozsahy, ne přesný obrat za konkrétní rok.
                Detail najdeš v informace ve výročních zprávách v Sbírce listin.
              </div>
            </div>
          )}

          {isEdit && (
            <div className="p-3 bg-violet-50 border border-violet-200 rounded">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-semibold text-sm">AI analýza strategie</div>
                  <div className="text-xs text-slate-600">
                    {aiAnalysisAt
                      ? `Uloženo: ${new Date(aiAnalysisAt).toLocaleString("cs-CZ")}`
                      : "Claude posoudí fit s ICP KonceptHK a navrhne první e-mail. Pracuje s uloženými daty — před analýzou změny nejdřív ulož."}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {aiResult && (
                    <button
                      type="button"
                      onClick={handleDeleteAiAnalysis}
                      className="btn-secondary"
                      disabled={aiLoading}
                    >
                      Smazat
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAiAnalysis}
                    className="btn-primary"
                    disabled={aiLoading}
                  >
                    {aiLoading
                      ? "Analyzuji…"
                      : aiResult
                        ? "Spustit znovu"
                        : "Spustit AI analýzu"}
                  </button>
                </div>
              </div>
              {aiError && (
                <div className="mt-2 text-sm text-red-700">{aiError}</div>
              )}
              {aiResult && (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-3xl font-bold text-violet-700">
                      {aiResult.score}/10
                    </div>
                    <div className="font-medium">{aiResult.verdict}</div>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Zdůvodnění</div>
                    <div className="whitespace-pre-wrap text-slate-700">
                      {aiResult.reasoning}
                    </div>
                  </div>
                  {aiResult.recommendations?.length > 0 && (
                    <div>
                      <div className="font-semibold mb-1">Doporučené kroky</div>
                      <ul className="list-disc list-inside space-y-1 text-slate-700">
                        {aiResult.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-white border border-violet-200 rounded p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="font-semibold">Draft prvního e-mailu</div>
                      <button
                        type="button"
                        onClick={handleCopyEmail}
                        className="btn-secondary text-xs"
                      >
                        {emailCopied ? "Zkopírováno ✓" : "Zkopírovat"}
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 mb-1">Předmět:</div>
                    <div className="font-medium mb-2">{aiResult.email.subject}</div>
                    <div className="text-xs text-slate-500 mb-1">Tělo:</div>
                    <div className="whitespace-pre-wrap text-slate-800">
                      {aiResult.email.body}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn-danger"
                  disabled={loading}
                >
                  Smazat
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
              >
                Zrušit
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit"}
              </button>
            </div>
          </div>
        </form>

        {isEdit && (
          <div className="border-t p-4 bg-slate-50">
            <h3 className="font-semibold text-sm mb-3">Historie aktivit</h3>
            <form
              onSubmit={handleAddActivity}
              className="flex flex-wrap gap-2 mb-4"
            >
              <select
                className="input max-w-[180px]"
                value={activityForm.type}
                onChange={(e) =>
                  setActivityForm({ ...activityForm, type: e.target.value })
                }
              >
                {ACTIVITY_TYPES.filter((a) => a.value !== "STAGE_CHANGE").map(
                  (a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  )
                )}
              </select>
              <input
                className="input flex-1 min-w-[180px]"
                placeholder="Poznámka…"
                value={activityForm.note}
                onChange={(e) =>
                  setActivityForm({ ...activityForm, note: e.target.value })
                }
              />
              <button type="submit" className="btn-primary">
                Přidat
              </button>
            </form>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {activities.length === 0 ? (
                <div className="text-sm text-slate-500">Žádné aktivity</div>
              ) : (
                activities.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white rounded border border-slate-200 p-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {activityTypeLabel(a.type)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(a.date).toLocaleString("cs-CZ")}
                        {a.user?.name ? ` · ${a.user.name}` : ""}
                      </span>
                    </div>
                    {a.note && (
                      <div className="text-slate-700 mt-1 whitespace-pre-wrap">
                        {a.note}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
