"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Company } from "@/types";
import { categoryLabel } from "@/lib/constants";

type Props = {
  company: Company;
  onClick: () => void;
};

export default function CompanyCard({ company, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: company.id, data: { type: "company", company } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const followUp = company.followUpDate ? new Date(company.followUpDate) : null;
  const overdue =
    followUp && followUp < new Date() && !["CLOSED", "REJECTED"].includes(company.stage);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={clsx(
        "bg-white rounded-md border border-slate-200 p-3 cursor-grab active:cursor-grabbing hover:border-brand-400 hover:shadow-sm transition",
        overdue && "border-l-4 border-l-red-500"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm text-slate-900 line-clamp-2">
          {company.name}
        </div>
      </div>
      {company.ico && (
        <div className="text-xs text-slate-500 mt-0.5">IČO: {company.ico}</div>
      )}
      {company.contactPerson && (
        <div className="text-xs text-slate-600 mt-1 line-clamp-1">
          {company.contactPerson}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
        <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
          {categoryLabel(company.category)}
        </span>
        {followUp && (
          <span
            className={clsx(
              "text-[10px] px-1.5 py-0.5 rounded",
              overdue
                ? "bg-red-100 text-red-700"
                : "bg-amber-50 text-amber-700"
            )}
          >
            {overdue ? "Po termínu: " : "Follow-up: "}
            {followUp.toLocaleDateString("cs-CZ")}
          </span>
        )}
      </div>
    </div>
  );
}
