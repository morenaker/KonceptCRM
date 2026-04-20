import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { categoryLabel, stageLabel } from "@/lib/constants";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search")?.trim();

  const where: any = {};
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { ico: { contains: search } },
    ];
  }

  const companies = await prisma.company.findMany({
    where,
    orderBy: [{ stage: "asc" }, { position: "asc" }],
  });

  const headers = [
    "Název",
    "IČO",
    "Kategorie",
    "Fáze",
    "Kontaktní osoba",
    "Telefon",
    "E-mail",
    "Poznámky",
    "Follow-up",
    "Poslední aktivita",
    "Vytvořeno",
  ];

  const rows = companies.map((c) =>
    [
      c.name,
      c.ico ?? "",
      categoryLabel(c.category),
      stageLabel(c.stage),
      c.contactPerson ?? "",
      c.phone ?? "",
      c.email ?? "",
      (c.notes ?? "").replace(/\n/g, " "),
      formatDate(c.followUpDate),
      formatDate(c.lastActivity),
      formatDate(c.createdAt),
    ]
      .map(csvEscape)
      .join(";")
  );

  const csv = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
  const filename = `firmy-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
