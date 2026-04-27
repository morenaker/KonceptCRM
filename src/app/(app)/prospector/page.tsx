"use client";
import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";

type Prospect = {
  name: string;
  ico: string | null;
  web: string | null;
  contactPerson: string | null;
  category: "TECHNICAL" | "LABORATORY" | "SECURITY" | "ESHOP" | "OTHER";
  score: number;
  reasoning: string;
  signal: string | null;
  sources: string[];
};

export default function ProspectorPage() {
  const [segment, setSegment] =
    useState<"TECHNICAL" | "LABORATORY" | "SECURITY" | "ESHOP" | "OTHER">("TECHNICAL");
  const [region, setRegion] = useState("");
  const [hint, setHint] = useState("");
  const [count, setCount] = useState(8);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<{
    created: number;
    skipped: { name: string; ico: string | null; reason: string }[];
  } | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProspects([]);
    setSelected(new Set());
    setAddResult(null);
    try {
      const res = await fetch("/api/prospector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment,
          region: region.trim() || null,
          hint: hint.trim() || null,
          count,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Hledání selhalo.");
      }
      setProspects(data.prospects ?? []);
      if (!data.prospects?.length) {
        setError("Nic nenalezeno. Zkus jiný region nebo přidat konkrétnější kritérium.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === prospects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(prospects.map((_, i) => i)));
    }
  }

  async function handleAdd() {
    const chosen = prospects.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setAdding(true);
    setError(null);
    setAddResult(null);
    try {
      const res = await fetch("/api/companies/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "NEW",
          companies: chosen.map((p) => ({
            name: p.name,
            ico: p.ico,
            web: p.web,
            contactPerson: p.contactPerson,
            category: p.category,
            notes: buildNotesFromProspect(p),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Přidání selhalo.");
      setAddResult(data);
      const createdIndices = new Set<number>();
      chosen.forEach((_, idx) => {
        const originalIdx = [...selected][idx];
        if (idx < data.created) createdIndices.add(originalIdx);
      });
      setProspects((prev) => prev.filter((_, i) => !selected.has(i)));
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-bold mb-2">AI Prospektor</h1>
      <p className="text-sm text-slate-600 mb-4">
        Claude prohledá český internet a navrhne firmy které sedí do ICP KonceptHK.
        Vyloučí firmy, které už v CRM máš. Jeden běh stojí cca 5–15 Kč.
      </p>

      <form
        onSubmit={handleSearch}
        className="bg-white border border-slate-200 rounded p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <div>
          <label className="label">Segment *</label>
          <select
            className="input"
            value={segment}
            onChange={(e) => setSegment(e.target.value as any)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Region (volitelné)</label>
          <input
            className="input"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="např. Královéhradecký kraj"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Další kritérium (volitelné)</label>
          <textarea
            className="input min-h-[60px]"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="např. firmy s novým statutárem za poslední rok"
          />
        </div>
        <div>
          <label className="label">Počet návrhů</label>
          <select
            className="input max-w-[120px]"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={8}>8</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="btn-primary w-full sm:w-auto"
            disabled={loading}
          >
            {loading ? "Hledám (až 1 min)…" : "Najít potenciální klienty"}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded mb-4">
          {error}
        </div>
      )}

      {addResult && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded mb-4">
          Přidáno: <strong>{addResult.created}</strong> firem.
          {addResult.skipped.length > 0 && (
            <div className="mt-2">
              <div className="font-semibold">Přeskočeno ({addResult.skipped.length}):</div>
              <ul className="list-disc list-inside">
                {addResult.skipped.map((s, i) => (
                  <li key={i}>
                    {s.name}
                    {s.ico ? ` (IČO ${s.ico})` : ""} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {prospects.length > 0 && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-sm text-slate-600">
            Nalezeno {prospects.length} firem, vybráno {selected.size}.
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={toggleAll} className="btn-secondary">
              {selected.size === prospects.length ? "Odznačit vše" : "Vybrat vše"}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="btn-primary"
              disabled={adding || selected.size === 0}
            >
              {adding ? "Přidávám…" : `Přidat vybrané (${selected.size})`}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {prospects.map((p, i) => {
          const isSelected = selected.has(i);
          return (
            <div
              key={i}
              className={`border rounded p-3 bg-white cursor-pointer transition ${
                isSelected
                  ? "border-violet-500 bg-violet-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => toggle(i)}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(i)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-2xl font-bold text-violet-700 shrink-0">
                      {p.score}/10
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5 mb-2">
                    {p.ico && (
                      <div>
                        IČO: {p.ico}{" "}
                        <a
                          href={`https://ares.gov.cz/ekonomicke-subjekty?ico=${p.ico}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline"
                        >
                          ověřit v ARES
                        </a>
                      </div>
                    )}
                    {p.web && (
                      <div>
                        Web:{" "}
                        <a
                          href={p.web}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline"
                        >
                          {p.web}
                        </a>
                      </div>
                    )}
                    {p.contactPerson && <div>Statutár: {p.contactPerson}</div>}
                  </div>
                  {p.signal && (
                    <div className="text-xs bg-amber-100 text-amber-900 rounded px-2 py-1 inline-block mb-2">
                      Signál: {p.signal}
                    </div>
                  )}
                  <div className="text-sm text-slate-700 mb-2">{p.reasoning}</div>
                  {p.sources?.length > 0 && (
                    <div className="text-xs text-slate-500">
                      Zdroje:{" "}
                      {p.sources.map((s, idx) => (
                        <span key={idx}>
                          {idx > 0 && ", "}
                          <a
                            href={s}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline"
                          >
                            {tryDomain(s)}
                          </a>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildNotesFromProspect(p: Prospect): string {
  const lines: string[] = ["--- AI Prospektor ---"];
  lines.push(`Fit skóre: ${p.score}/10`);
  if (p.signal) lines.push(`Signál: ${p.signal}`);
  lines.push(`Zdůvodnění: ${p.reasoning}`);
  if (p.sources?.length) lines.push(`Zdroje: ${p.sources.join(", ")}`);
  lines.push("--- /AI Prospektor ---");
  return lines.join("\n");
}

function tryDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
