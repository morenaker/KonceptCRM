import { prisma } from "@/lib/prisma";
import { CATEGORIES, STAGES, categoryLabel, stageLabel } from "@/lib/constants";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getData() {
  const [total, byStage, byCategory, overdue, upcoming] = await Promise.all([
    prisma.company.count(),
    prisma.company.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.company.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.company.findMany({
      where: {
        followUpDate: { lt: new Date() },
        stage: { notIn: ["CLOSED", "REJECTED"] },
      },
      orderBy: { followUpDate: "asc" },
      take: 10,
    }),
    prisma.company.findMany({
      where: {
        followUpDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 86400_000),
        },
        stage: { notIn: ["CLOSED", "REJECTED"] },
      },
      orderBy: { followUpDate: "asc" },
      take: 10,
    }),
  ]);

  return {
    total,
    byStage: Object.fromEntries(byStage.map((r) => [r.stage, r._count._all])),
    byCategory: Object.fromEntries(
      byCategory.map((r) => [r.category, r._count._all])
    ),
    overdue,
    upcoming,
  };
}

export default async function DashboardPage() {
  const data = await getData();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Přehled</h1>

      {/* AI Prospektor CTA */}
      <Link
        href="/prospector"
        className="block rounded-lg border border-violet-300 bg-gradient-to-r from-violet-50 to-white p-4 hover:border-violet-500 hover:shadow-sm transition"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-violet-800">
              🔎 AI Prospektor — najít nové klienty
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Claude prohledá český internet a navrhne firmy sedící do ICP
              KonceptHK. Vyloučí ty, které už v CRM máš.
            </div>
          </div>
          <div className="text-sm font-medium text-violet-700 whitespace-nowrap">
            Spustit →
          </div>
        </div>
      </Link>

      {/* summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Celkem firem" value={data.total} accent="text-brand-700" />
        <Stat
          label="Po termínu"
          value={data.overdue.length}
          accent={data.overdue.length > 0 ? "text-red-600" : "text-slate-700"}
        />
        <Stat
          label="Uzavřeno"
          value={data.byStage.CLOSED ?? 0}
          accent="text-green-700"
        />
        <Stat
          label="Odmítnuto"
          value={data.byStage.REJECTED ?? 0}
          accent="text-slate-600"
        />
      </div>

      {/* by stage */}
      <section>
        <h2 className="font-semibold mb-2">Podle fáze</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {STAGES.map((s) => (
            <div
              key={s.value}
              className={`rounded-md border p-3 ${s.color}`}
            >
              <div className="text-xs text-slate-600">{s.label}</div>
              <div className="text-2xl font-bold">
                {data.byStage[s.value] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* by category */}
      <section>
        <h2 className="font-semibold mb-2">Podle kategorie</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map((c) => (
            <div
              key={c.value}
              className="rounded-md border border-slate-200 bg-white p-3"
            >
              <div className="text-xs text-slate-600">{c.label}</div>
              <div className="text-2xl font-bold">
                {data.byCategory[c.value] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* overdue list */}
      <section>
        <h2 className="font-semibold mb-2">Follow-upy po termínu</h2>
        <div className="bg-white rounded-md border border-slate-200 divide-y">
          {data.overdue.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">
              Žádné po termínu 🎉
            </div>
          ) : (
            data.overdue.map((c) => (
              <Link
                key={c.id}
                href="/board"
                className="flex items-center justify-between p-3 text-sm hover:bg-slate-50"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {categoryLabel(c.category)} · {stageLabel(c.stage)}
                  </div>
                </div>
                <div className="text-red-600 text-sm">
                  {c.followUpDate
                    ? new Date(c.followUpDate).toLocaleDateString("cs-CZ")
                    : ""}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* upcoming list */}
      <section>
        <h2 className="font-semibold mb-2">Nadcházející follow-upy (7 dní)</h2>
        <div className="bg-white rounded-md border border-slate-200 divide-y">
          {data.upcoming.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">Nic naplánováno</div>
          ) : (
            data.upcoming.map((c) => (
              <Link
                key={c.id}
                href="/board"
                className="flex items-center justify-between p-3 text-sm hover:bg-slate-50"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {categoryLabel(c.category)} · {stageLabel(c.stage)}
                  </div>
                </div>
                <div className="text-amber-700 text-sm">
                  {c.followUpDate
                    ? new Date(c.followUpDate).toLocaleDateString("cs-CZ")
                    : ""}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-md border border-slate-200 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`text-3xl font-bold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
