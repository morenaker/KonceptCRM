import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";

const companyCreateSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  ico: z.string().optional().nullable(),
  web: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Neplatný e-mail").optional().or(z.literal("")).nullable(),
  category: z.enum(["TECHNICAL", "LABORATORY", "SECURITY", "OTHER"]),
  stage: z
    .enum(["NEW", "CONTACTED", "WAITING", "NEGOTIATION", "CLOSED", "REJECTED"])
    .default("NEW"),
  notes: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
});

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
    include: {
      activities: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const parsed = companyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const lastInStage = await prisma.company.findFirst({
    where: { stage: data.stage },
    orderBy: { position: "desc" },
  });
  const position = (lastInStage?.position ?? -1) + 1;

  const company = await prisma.company.create({
    data: {
      name: data.name,
      ico: data.ico || null,
      web: data.web || null,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      category: data.category,
      stage: data.stage,
      notes: data.notes || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      position,
      lastActivity: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      companyId: company.id,
      userId: session!.user.id,
      type: "NOTE",
      note: "Firma vytvořena.",
    },
  });

  return NextResponse.json(company, { status: 201 });
}
