"use client";
import { CATEGORIES } from "@/lib/constants";

type Props = {
  category: string;
  search: string;
  onCategoryChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onExport: () => void;
  onAdd: () => void;
};

export default function Filters({
  category,
  search,
  onCategoryChange,
  onSearchChange,
  onExport,
  onAdd,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <input
        type="search"
        placeholder="Hledat podle názvu nebo IČO…"
        className="input max-w-xs flex-1"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        className="input max-w-xs"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">Všechny kategorie</option>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <div className="flex-1" />
      <button onClick={onExport} className="btn-secondary">
        Export CSV
      </button>
      <button onClick={onAdd} className="btn-primary">
        + Nová firma
      </button>
    </div>
  );
}
