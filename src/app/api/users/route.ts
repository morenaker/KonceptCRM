import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guards";

const userCreateSchema = z.object({
  email: z.string().email("Neplatný e-mail"),
  name: z.string().min(1, "Jméno je povinné"),
  password: z.string().min(6, "Minimálně 6 znaků"),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const exists = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (exists) {
    return NextResponse.json({ error: "E-mail již existuje" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
      password: hashed,
      role: data.role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
