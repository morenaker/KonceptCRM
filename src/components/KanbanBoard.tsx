"use client";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { STAGES } from "@/lib/constants";
import type { Company } from "@/types";
import KanbanColumn from "./KanbanColumn";
import CompanyCard from "./CompanyCard";

type Props = {
  companies: Company[];
  onCompaniesChange: (c: Company[]) => void;
  onCardClick: (c: Company) => void;
};

export default function KanbanBoard({
  companies,
  onCompaniesChange,
  onCardClick,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const grouped = useMemo(() => {
    const map: Record<string, Company[]> = {};
    for (const s of STAGES) map[s.value] = [];
    for (const c of companies) {
      if (!map[c.stage]) map[c.stage] = [];
      map[c.stage].push(c);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [companies]);

  const activeCompany = activeId
    ? companies.find((c) => c.id === activeId)
    : null;

  function findContainer(id: string): string | null {
    if (STAGES.some((s) => s.value === id)) return id;
    const c = companies.find((x) => x.id === id);
    return c?.stage ?? null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const activeContainer = findContainer(activeIdStr);
    const overContainer = findContainer(overIdStr);
    if (!activeContainer || !overContainer) return;
    if (activeContainer === overContainer) return;

    // moved into a new column — update stage immediately for visual feedback
    const next = companies.map((c) =>
      c.id === activeIdStr ? { ...c, stage: overContainer } : c
    );
    onCompaniesChange(next);
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const activeCompanyNow = companies.find((c) => c.id === activeIdStr);
    if (!activeCompanyNow) return;

    const oldStage = activeCompany?.stage ?? activeCompanyNow.stage;
    const overContainer = findContainer(overIdStr);
    if (!overContainer) return;

    // build new grouping after the (possibly cross-column) drop
    const working = companies.map((c) =>
      c.id === activeIdStr ? { ...c, stage: overContainer } : c
    );

    // reorder within target column
    const inTarget = working
      .filter((c) => c.stage === overContainer)
      .sort((a, b) => a.position - b.position);

    const currentIndex = inTarget.findIndex((c) => c.id === activeIdStr);
    let targetIndex = currentIndex;
    if (overIdStr !== overContainer) {
      const overIndex = inTarget.findIndex((c) => c.id === overIdStr);
      if (overIndex !== -1) targetIndex = overIndex;
    } else {
      targetIndex = inTarget.length - 1;
    }
    const reordered = arrayMove(inTarget, currentIndex, targetIndex);

    // reassign positions
    const positionsMap = new Map<string, number>();
    reordered.forEach((c, i) => positionsMap.set(c.id, i));

    const finalList = working.map((c) =>
      positionsMap.has(c.id)
        ? { ...c, position: positionsMap.get(c.id)! }
        : c
    );
    onCompaniesChange(finalList);

    const updates = reordered.map((c) => ({
      id: c.id,
      stage: overContainer,
      position: positionsMap.get(c.id)!,
    }));

    await fetch("/api/companies/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates,
        movedId: activeIdStr,
        newStage: overContainer,
        oldStage,
      }),
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 kanban-scroll">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.value}
            stage={stage}
            companies={grouped[stage.value] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCompany && (
          <div className="rotate-2">
            <CompanyCard company={activeCompany} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
