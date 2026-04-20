import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const [total, byStage, byCategory, overdue] = await Promise.all([
    prisma.company.count(),
    prisma.company.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.company.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.company.count({
      where: {
        followUpDate: { lt: new Date() },
        stage: { notIn: ["CLOSED", "REJECTED"] },
      },
    }),
  ]);

  return NextResponse.json({
    total,
    byStage: Object.fromEntries(byStage.map((r) => [r.stage, r._count._all])),
    byCategory: Object.fromEntries(
      byCategory.map((r) => [r.category, r._count._all])
    ),
    overdue,
  });
}
