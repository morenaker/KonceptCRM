import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";

const reorderSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string(),
      stage: z.enum(["NEW", "CONTACTED", "WAITING", "NEGOTIATION", "CLOSED", "REJECTED"]),
      position: z.number().int(),
    })
  ),
  movedId: z.string().optional(),
  newStage: z
    .enum(["NEW", "CONTACTED", "WAITING", "NEGOTIATION", "CLOSED", "REJECTED"])
    .optional(),
  oldStage: z
    .enum(["NEW", "CONTACTED", "WAITING", "NEGOTIATION", "CLOSED", "REJECTED"])
    .optional(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { updates, movedId, newStage, oldStage } = parsed.data;

  await prisma.$transaction(
    updates.map((u) =>
      prisma.company.update({
        where: { id: u.id },
        data: { stage: u.stage, position: u.position, lastActivity: new Date() },
      })
    )
  );

  if (movedId && newStage && oldStage && newStage !== oldStage) {
    await prisma.activity.create({
      data: {
        companyId: movedId,
        userId: session!.user.id,
        type: "STAGE_CHANGE",
        note: `Změna fáze: ${oldStage} → ${newStage}`,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
