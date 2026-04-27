import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { isValidIco, normalizeIco } from "@/lib/validators";
import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

export const maxDuration = 60;

const requestSchema = z.object({
  segment: z.enum(["TECHNICAL", "LABORATORY", "SECURITY", "ESHOP", "OTHER"]),
  region: z.string().optional().nullable(),
  hint: z.string().optional().nullable(),
  count: z.number().int().min(3).max(15).default(8),
});

const SEGMENT_LABEL: Record<string, string> = {
  TECHNICAL: "Technické služby",
  LABORATORY: "Laboratoře a certifikační služby",
  SECURITY: "Bezpečnostní a security služby",
  ESHOP: "E-shop (vlastní rozhraní plně propojené s HELIOS Nephrite)",
  OTHER: "Jiné (pojišťovací makléři, příspěvkové organizace, atd.)",
};

const submitTool = {
  name: "submit_prospects",
  description:
    "Odešle seznam nalezených potenciálních klientů. Volej tento nástroj pouze JEDNOU na samém konci, až máš dostatek informací.",
  input_schema: {
    type: "object" as const,
    properties: {
      prospects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Oficiální obchodní název firmy." },
            ico: {
              type: ["string", "null"],
              description:
                "8-místné IČO. Pokud neznáš přesně, uveď null (neriskuj výmysl).",
            },
            web: {
              type: ["string", "null"],
              description: "URL oficiálního webu firmy (s https://).",
            },
            contactPerson: {
              type: ["string", "null"],
              description:
                "Statutární orgán / ředitel / majitel pokud jsi ho dohledal z veřejných zdrojů. Jinak null.",
            },
            category: {
              type: "string",
              enum: ["TECHNICAL", "LABORATORY", "SECURITY", "ESHOP", "OTHER"],
              description: "Segment zařazení (měl by odpovídat zadanému segmentu).",
            },
            score: {
              type: "integer",
              minimum: 1,
              maximum: 10,
              description: "Fit skóre proti ICP KonceptHK (1 špatné, 10 ideální).",
            },
            reasoning: {
              type: "string",
              description: "2–4 věty proč tato firma zapadá (velikost, obor, signály).",
            },
            signal: {
              type: ["string", "null"],
              description:
                "Aktuální nákupní signál pokud existuje (změna vedení, fúze, růst, konec podpory starého systému). Jinak null.",
            },
            sources: {
              type: "array",
              items: { type: "string" },
              description: "URL zdrojů odkud jsi informace čerpal.",
            },
          },
          required: [
            "name",
            "ico",
            "web",
            "contactPerson",
            "category",
            "score",
            "reasoning",
            "signal",
            "sources",
          ],
        },
      },
    },
    required: ["prospects"],
  },
};

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Chybí ANTHROPIC_API_KEY v prostředí. Přidej klíč z console.anthropic.com a restartuj.",
      },
      { status: 500 }
    );
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { segment, region, hint, count } = parsed.data;

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

  const existing = await prisma.company.findMany({
    select: { name: true, ico: true },
  });
  const excludeLines = existing
    .map((e) => `- ${e.name}${e.ico ? ` (IČO ${e.ico})` : ""}`)
    .join("\n");
  const excludeIcos = new Set(existing.map((e) => (e.ico || "").trim()).filter(Boolean));
  const excludeNames = existing.map((e) => e.name.toLowerCase());

  const isEshop = segment === "ESHOP";
  const eshopHint = isEshop
    ? [
        "",
        "=== POKYNY PRO SEGMENT E-SHOP ===",
        "U tohoto segmentu hledáme zákazníky e-shop rozhraní (KonceptHK ho prodává jako vlastní produkt plně integrovaný s HELIOS Nephrite). Tedy NE tvůrce e-shopů — Shoptet, Upgates, WooCommerce specialisté apod. jsou KONKURENCE, ne klienti.",
        "Ideální klienty hledej ve 3 pod-typech (od nejvyšší pravděpodobnosti konverze):",
        "1) Firmy které prokazatelně používají HELIOS Nephrite (ekonomický systém) a zároveň mají cizí/zastaralý e-shop (Shoptet, WooCommerce, vlastní starý systém). NEJVYŠŠÍ FIT.",
        "2) Výrobní firmy s prodejem které vůbec nemají e-shop, ale viditelně mají co prodávat (katalog produktů, B2B prodej offline).",
        "3) Výrobní firmy s prodejem bez HELIOSu i bez e-shopu — největší zakázka (e-shop + HELIOS současně), ale nejnižší pravděpodobnost.",
        "Při web searchi: dotazy typu 'HELIOS Nephrite reference', 'česká výrobní firma e-shop B2B', kombinace s regionem.",
        "Min. velikost firmy 30 zaměstnanců.",
        "V poli signal vždy uveď zjištěný stav, např. 'má HELIOS Nephrite, e-shop na Shoptetu' / 'výrobce X bez e-shopu' / 'výrobce Y, ERP neznámý, bez e-shopu'.",
      ].join("\n")
    : "";

  const systemPrompt = [
    "Jsi B2B obchodní prospektor pro českou firmu KonceptHK (HELIOS Nephrite ERP).",
    "Tvým úkolem je najít na českém internetu reálné české firmy, které nejlépe zapadají do ICP KonceptHK.",
    "Používej web search opakovaně (max 3×) — hledej v ARES, na Justice.cz, LinkedIn, firemních webech a v obchodním rejstříku.",
    "Upřednostňuj firmy s nákupním signálem (změna vedení je nejsilnější).",
    "NIKDY nevymýšlej IČO — pokud si nejsi jistý, uveď null.",
    "Až máš dost informací, zavolej nástroj submit_prospects JEDNOU s celým seznamem.",
    eshopHint,
    "",
    "=== PROFIL A ICP KONCEPTHK ===",
    profile,
    "=== KONEC PROFILU ===",
  ].join("\n");

  const userPromptParts: string[] = [
    `Najdi ${count} reálných českých firem v segmentu: ${SEGMENT_LABEL[segment]}.`,
  ];
  if (region && region.trim()) {
    userPromptParts.push(`Region / lokalita: ${region.trim()}`);
  }
  if (hint && hint.trim()) {
    userPromptParts.push(`Další kritérium od uživatele: ${hint.trim()}`);
  }
  userPromptParts.push(
    "",
    "DŮLEŽITÉ — nenavrhuj firmy, které už máme v CRM. Seznam (NEPŘIDÁVEJ tyto):",
    excludeLines || "(seznam je prázdný)"
  );

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: systemPrompt,
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 3 },
        submitTool,
      ] as any,
      messages: [{ role: "user", content: userPromptParts.join("\n") }],
    });

    const toolUse = response.content.find(
      (b: any) => b.type === "tool_use" && b.name === "submit_prospects"
    ) as any;

    if (!toolUse) {
      return NextResponse.json(
        {
          error:
            "Claude nevrátil strukturovaný seznam. Zkus to znovu s méně návrhy nebo konkrétnějším kritériem.",
        },
        { status: 502 }
      );
    }

    const raw: any[] = toolUse.input?.prospects ?? [];
    const prospects = raw
      .map((p) => {
        const icoNorm = normalizeIco(p.ico);
        const icoClean = icoNorm && isValidIco(icoNorm) ? icoNorm : null;
        return { ...p, ico: icoClean };
      })
      .filter((p) => {
        if (!p.name || typeof p.name !== "string") return false;
        if (p.ico && excludeIcos.has(p.ico)) return false;
        const nameLc = String(p.name).toLowerCase();
        if (excludeNames.some((n) => n === nameLc || nameLc.includes(n) || n.includes(nameLc))) {
          return false;
        }
        return true;
      });

    return NextResponse.json({ prospects });
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
