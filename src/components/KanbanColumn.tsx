"use client";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import clsx from "clsx";
import type { Company } from "@/types";
import CompanyCard from "./CompanyCard";

type Props = {
  stage: { value: string; label: string; color: string };
  companies: Company[];
  onCardClick: (c: Company) => void;
};

export default function KanbanColumn({ stage, companies, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.value,
    data: { type: "column", stage: stage.value },
  });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-slate-100 rounded-lg border border-slate-200">
      <div
        className={clsx(
          "px-3 py-2 rounded-t-lg border-b flex items-center justify-between",
          stage.color
        )}
      >
        <h3 className="font-semibold text-sm text-slate-800">{stage.label}</h3>
        <span className="text-xs font-medium bg-white/70 text-slate-700 px-2 py-0.5 rounded-full">
          {companies.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          "flex-1 p-2 space-y-2 min-h-[120px] transition",
          isOver && "bg-brand-50"
        )}
      >
        <SortableContext
          items={companies.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {companies.map((c) => (
            <CompanyCard key={c.id} company={c} onClick={() => onCardClick(c)} />
          ))}
        </SortableContext>
        {companies.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-4">
            Žádné firmy
          </div>
        )}
      </div>
    </div>
  );
}
