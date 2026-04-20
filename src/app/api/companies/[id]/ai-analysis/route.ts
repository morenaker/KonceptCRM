import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: "Technické služby",
  LABORATORY: "Laboratoře",
  SECURITY: "Bezpečnostní služby",
  OTHER: "Jiné",
};

const STAGE_LABELS: Record<string, string> = {
  NEW: "Nová",
  CONTACTED: "Oslovená",
  WAITING: "Čeká se",
  NEGOTIATION: "Jednání",
  CLOSED: "Uzavřeno",
  REJECTED: "Odmítnuto",
};

const analysisTool = {
  name: "submit_fit_analysis",
  description:
    "Odešle výsledek analýzy fit mezi cílovou firmou a KonceptHK + draft prvního e-mailu.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "Fit skóre 1–10 (1 = špatný fit, 10 = ideální zákazník).",
      },
      verdict: {
        type: "string",
        description: "Jednovětný verdikt (např. 'Silný fit, jednat hned').",
      },
      reasoning: {
        type: "string",
        description:
          "Zdůvodnění skóre v 3–6 větách v češtině — proč firma zapadá / nezapadá do ICP (velikost, obor, signály, konkurence).",
      },
      recommendations: {
        type: "array",
        items: { type: "string" },
        description:
          "3–5 konkrétních doporučení dalších kroků v češtině (např. 'Oslovit statutára s referencí z XY', 'Počkat na změnu vedení').",
      },
      email: {
        type: "object",
        properties: {
          subject: {
            type: "string",
            description: "Předmět e-mailu v češtině, max 60 znaků.",
          },
          body: {
            type: "string",
            description:
              "Tělo úvodního e-mailu v češtině. Profesionální tón, vykání, 4–7 vět, zmínka relevantního nákupního signálu (je-li známý), konkrétní benefit pro jejich obor, jasný call-to-action (schůzka nebo krátký hovor). Podpis 'Tým KonceptHK'.",
          },
        },
        required: ["subject", "body"],
      },
    },
    required: ["score", "verdict", "reasoning", "recommendations", "email"],
  },
};

function formatCompanyForPrompt(c: any): string {
  const lines: string[] = [];
  lines.push(`Název: ${c.name}`);
  if (c.ico) lines.push(`IČO: ${c.ico}`);
  if (c.web) lines.push(`Web: ${c.web}`);
  lines.push(`Segment (podle nás): ${CATEGORY_LABELS[c.category] ?? c.category}`);
  lines.push(`Fáze v CRM: ${STAGE_LABELS[c.stage] ?? c.stage}`);
  if (c.contactPerson) lines.push(`Kontaktní osoba: ${c.contactPerson}`);
  if (c.phone) lines.push(`Telefon: ${c.phone}`);
  if (c.email) lines.push(`E-mail: ${c.email}`);
  if (c.notes) lines.push(`\nPoznámky (včetně případných dat z ARES):\n${c.notes}`);
  return lines.join("\n");
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  await prisma.company.update({
    where: { id: params.id },
    data: { aiAnalysis: null, aiAnalysisAt: null },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Chybí ANTHROPIC_API_KEY v .env. Přidej klíč z console.anthropic.com a restartuj server.",
      },
      { status: 500 }
    );
  }

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) {
    return NextResponse.json({ error: "Firma nenalezena" }, { status: 404 });
  }

  let profile = "";
  try {
    profile = await fs.readFile(
      path.join(process.cwd(), "src", "lib", "company-profile.md"),
      "utf8"
    );
  } catch {
    return NextResponse.json(
      { error: "Nepodařilo se načíst src/lib/company-profile.md" },
      { status: 500 }
    );
  }

  const systemPrompt = [
    "Jsi zkušený B2B obchodní analytik pro českou firmu KonceptHK.",
    "Tvým úkolem je posoudit konkrétní cílovou firmu podle níže uvedeného profilu a ICP KonceptHK,",
    "dát fit skóre 1–10 a napsat draft prvního oslovovacího e-mailu v češtině.",
    "Buď konkrétní, věcný, bez marketingových frází. Pracuj pouze s informacemi, které máš.",
    "Pokud některá informace chybí (např. obrat, počet zaměstnanců, signály), řekni to upřímně ve zdůvodnění a sniž jistotu skóre.",
    "Výstup vrať POUZE přes nástroj submit_fit_analysis.",
    "",
    "=== PROFIL A PRODEJNÍ KONTEXT KONCEPTHK ===",
    profile,
    "=== KONEC PROFILU ===",
  ].join("\n");

  const userPrompt = [
    "Posuď následující cílovou firmu a vrať fit skóre + draft prvního e-mailu.",
    "",
    "=== CÍLOVÁ FIRMA ===",
    formatCompanyForPrompt(company),
    "=== KONEC ===",
  ].join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [analysisTool] as any,
      tool_choice: { type: "tool", name: "submit_fit_analysis" } as any,
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find(
      (b: any) => b.type === "tool_use" && b.name === "submit_fit_analysis"
    ) as any;

    if (!toolUse) {
      return NextResponse.json(
        { error: "Claude nevrátil očekávaný výstup." },
        { status: 502 }
      );
    }

    const now = new Date();
    await prisma.company.update({
      where: { id: company.id },
      data: {
        aiAnalysis: JSON.stringify(toolUse.input),
        aiAnalysisAt: now,
      },
    });

    return NextResponse.json({ ...toolUse.input, aiAnalysisAt: now.toISOString() });
  } catch (e: any) {
    const message =
      e?.error?.error?.message ||
      e?.message ||
      "Neznámá chyba při volání Claude API.";
    return NextResponse.json(
      { error: `Chyba Claude API: ${message}` },
      { status: 502 }
    );
  }
}
