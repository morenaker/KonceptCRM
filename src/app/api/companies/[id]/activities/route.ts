import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";

const activitySchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "STAGE_CHANGE"]),
  note: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const activities = await prisma.activity.findMany({
    where: { companyId: params.id },
    orderBy: { date: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json(activities);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const parsed = activitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  const activity = await prisma.activity.create({
    data: {
      companyId: params.id,
      userId: session!.user.id,
      type: data.type,
      note: data.note || null,
      date: data.date ? new Date(data.date) : new Date(),
    },
    include: { user: { select: { name: true, email: true } } },
  });

  await prisma.company.update({
    where: { id: params.id },
    data: { lastActivity: new Date() },
  });

  return NextResponse.json(activity, { status: 201 });
}
