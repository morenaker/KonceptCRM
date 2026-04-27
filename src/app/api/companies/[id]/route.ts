import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { isValidIco, normalizeIco } from "@/lib/validators";

const companyUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  ico: z.string().optional().nullable(),
  web: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  category: z
    .enum(["TECHNICAL", "LABORATORY", "SECURITY", "ESHOP", "OTHER"])
    .optional(),
  stage: z
    .enum(["NEW", "CONTACTED", "WAITING", "NEGOTIATION", "CLOSED", "REJECTED"])
    .optional(),
  notes: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  position: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      activities: {
        orderBy: { date: "desc" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!company) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";

  const body = await req.json();
  const parsed = companyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.company.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  let icoForUpdate: string | null | undefined;
  if (data.ico === undefined) {
    icoForUpdate = undefined;
  } else {
    const icoNorm = normalizeIco(data.ico);
    if (icoNorm && !isValidIco(icoNorm)) {
      return NextResponse.json(
        { error: "Neplatné IČO (chybný kontrolní součet)." },
        { status: 400 }
      );
    }
    if (icoNorm && !force) {
      const dup = await prisma.company.findFirst({
        where: { ico: icoNorm, NOT: { id: params.id } },
        select: { id: true, name: true },
      });
      if (dup) {
        return NextResponse.json(
          { error: "duplicate", existing: dup },
          { status: 409 }
        );
      }
    }
    icoForUpdate = icoNorm || null;
  }

  const updateData: any = {
    ...data,
    ico: icoForUpdate,
    web: data.web === undefined ? undefined : data.web || null,
    contactPerson:
      data.contactPerson === undefined ? undefined : data.contactPerson || null,
    phone: data.phone === undefined ? undefined : data.phone || null,
    email: data.email === undefined ? undefined : data.email || null,
    notes: data.notes === undefined ? undefined : data.notes || null,
    followUpDate:
      data.followUpDate === undefined
        ? undefined
        : data.followUpDate
          ? new Date(data.followUpDate)
          : null,
    lastActivity: new Date(),
  };

  const stageChanged = data.stage && data.stage !== existing.stage;

  const company = await prisma.company.update({
    where: { id: params.id },
    data: updateData,
  });

  if (stageChanged) {
    await prisma.activity.create({
      data: {
        companyId: company.id,
        userId: session!.user.id,
        type: "STAGE_CHANGE",
        note: `Změna fáze: ${existing.stage} → ${data.stage}`,
      },
    });
  }

  return NextResponse.json(company);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const existing = await prisma.company.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  await prisma.company.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
