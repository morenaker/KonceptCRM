import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { isValidIco, normalizeIco } from "@/lib/validators";

const bulkSchema = z.object({
  stage: z
    .enum(["NEW", "CONTACTED", "WAITING", "NEGOTIATION", "CLOSED", "REJECTED"])
    .default("NEW"),
  companies: z
    .array(
      z.object({
        name: z.string().min(1),
        ico: z.string().optional().nullable(),
        web: z.string().optional().nullable(),
        contactPerson: z.string().optional().nullable(),
        category: z.enum(["TECHNICAL", "LABORATORY", "SECURITY", "ESHOP", "OTHER"]),
        notes: z.string().optional().nullable(),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { stage, companies } = parsed.data;

  const lastInStage = await prisma.company.findFirst({
    where: { stage },
    orderBy: { position: "desc" },
  });
  let position = (lastInStage?.position ?? -1) + 1;

  let created = 0;
  const skipped: { name: string; ico: string | null; reason: string }[] = [];

  for (const c of companies) {
    const icoNorm = normalizeIco(c.ico);
    if (icoNorm && !isValidIco(icoNorm)) {
      skipped.push({
        name: c.name,
        ico: icoNorm,
        reason: "Neplatné IČO (mod-11)",
      });
      continue;
    }
    if (icoNorm) {
      const dup = await prisma.company.findFirst({
        where: { ico: icoNorm },
        select: { id: true },
      });
      if (dup) {
        skipped.push({
          name: c.name,
          ico: icoNorm,
          reason: "Firma s tímto IČO už v CRM existuje",
        });
        continue;
      }
    }

    const company = await prisma.company.create({
      data: {
        name: c.name,
        ico: icoNorm || null,
        web: c.web || null,
        contactPerson: c.contactPerson || null,
        phone: null,
        email: null,
        category: c.category,
        stage,
        notes: c.notes || null,
        followUpDate: null,
        position: position++,
        lastActivity: new Date(),
      },
    });
    await prisma.activity.create({
      data: {
        companyId: company.id,
        userId: session!.user.id,
        type: "NOTE",
        note: "Přidáno z AI Prospektoru.",
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped });
}
