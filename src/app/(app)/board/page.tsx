"use client";
import { useCallback, useEffect, useState } from "react";
import Filters from "@/components/Filters";
import KanbanBoard from "@/components/KanbanBoard";
import CompanyModal from "@/components/CompanyModal";
import type { Company } from "@/types";

export default function BoardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    const res = await fetch(`/api/companies?${params.toString()}`);
    if (res.ok) setCompanies(await res.json());
    setLoading(false);
  }, [category, search]);

  useEffect(() => {
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
  }, [load]);

  function openNew() {
    setSelected(null);
    setModalOpen(true);
  }

  function openEdit(c: Company) {
    setSelected(c);
    setModalOpen(true);
  }

  function handleSaved(c: Company) {
    setCompanies((prev) => {
      const existing = prev.find((x) => x.id === c.id);
      if (existing) return prev.map((x) => (x.id === c.id ? { ...x, ...c } : x));
      return [...prev, c];
    });
    setModalOpen(false);
  }

  function handleDeleted(id: string) {
    setCompanies((prev) => prev.filter((x) => x.id !== id));
    setModalOpen(false);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    window.location.href = `/api/companies/export?${params.toString()}`;
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Nástěnka</h1>
      <Filters
        category={category}
        search={search}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
        onAdd={openNew}
        onExport={exportCsv}
      />
      {loading && companies.length === 0 ? (
        <div className="text-slate-500">Načítám…</div>
      ) : (
        <KanbanBoard
          companies={companies}
          onCompaniesChange={setCompanies}
          onCardClick={openEdit}
        />
      )}
      <CompanyModal
        company={selected}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onOpenExisting={async (id) => {
          const inMemory = companies.find((x) => x.id === id);
          if (inMemory) {
            setSelected(inMemory);
            setModalOpen(true);
            return;
          }
          const res = await fetch(`/api/companies/${id}`);
          if (res.ok) {
            const fresh = await res.json();
            setCompanies((prev) =>
              prev.some((x) => x.id === fresh.id) ? prev : [...prev, fresh]
            );
            setSelected(fresh);
            setModalOpen(true);
          }
        }}
      />
    </div>
  );
}
