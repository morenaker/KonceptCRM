import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Nepřihlášen" }, { status: 401 }) };
  }
  return { session, error: null as null };
}

export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.user.role !== "ADMIN") {
    return {
      session: null,
      error: NextResponse.json({ error: "Přístup odepřen" }, { status: 403 }),
    };
  }
  return { session, error: null as null };
}
