import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guards";

// Kód -> čitelný popis (Číselník ČSÚ: kategorie počtu zaměstnanců)
const EMPLOYEE_CATEGORIES: Record<string, string> = {
  "000": "Neuvedeno",
  "110": "Bez zaměstnanců",
  "120": "1–5 zaměstnanců",
  "130": "6–9 zaměstnanců",
  "210": "10–19 zaměstnanců",
  "220": "20–24 zaměstnanců",
  "230": "25–49 zaměstnanců",
  "240": "50–99 zaměstnanců",
  "310": "100–199 zaměstnanců",
  "320": "200–249 zaměstnanců",
  "330": "250–499 zaměstnanců",
  "340": "500–999 zaměstnanců",
  "410": "1 000–1 499 zaměstnanců",
  "420": "1 500–1 999 zaměstnanců",
  "430": "2 000–2 499 zaměstnanců",
  "440": "2 500–2 999 zaměstnanců",
  "450": "3 000–3 999 zaměstnanců",
  "460": "4 000–4 999 zaměstnanců",
  "470": "5 000–9 999 zaměstnanců",
  "480": "10 000 a více zaměstnanců",
};

// Kód -> čitelný popis (Číselník ČSÚ: kategorie obratu)
const TURNOVER_CATEGORIES: Record<string, string> = {
  "1": "do 2 mil. Kč",
  "2": "2–10 mil. Kč",
  "3": "10–30 mil. Kč",
  "4": "30–60 mil. Kč",
  "5": "60–150 mil. Kč",
  "6": "150–300 mil. Kč",
  "7": "300–600 mil. Kč",
  "8": "600 mil.–1,5 mld. Kč",
  "9": "1,5–3 mld. Kč",
  "10": "3–6 mld. Kč",
  "11": "6–15 mld. Kč",
  "12": "15–30 mld. Kč",
  "13": "30 mld. a více Kč",
};

function formatAddress(sidlo: any): string | null {
  if (!sidlo) return null;
  if (typeof sidlo.textovaAdresa === "string" && sidlo.textovaAdresa.trim()) {
    return sidlo.textovaAdresa.trim();
  }
  const parts = [
    [sidlo.nazevUlice, sidlo.cisloDomovni].filter(Boolean).join(" "),
    [sidlo.psc, sidlo.nazevObce].filter(Boolean).join(" "),
  ].filter((s) => s && String(s).trim());
  return parts.length ? parts.join(", ") : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { ico: string } }
) {
  const { error } = await requireSession();
  if (error) return error;

  const ico = (params.ico || "").replace(/\D/g, "").padStart(8, "0");
  if (ico.length !== 8) {
    return NextResponse.json(
      { error: "Neplatné IČO (musí mít 8 číslic)" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );

    if (res.status === 404) {
      return NextResponse.json(
        { error: "Firma s tímto IČO nebyla v ARES nalezena." },
        { status: 404 }
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `ARES vrátil chybu (${res.status}).` },
        { status: 502 }
      );
    }

    const data = await res.json();

    const stat = data?.statistickeUdaje ?? {};
    const employeeCode: string | undefined =
      stat?.pocetZamestnancu ?? stat?.kategoriePoctuPracovniku;
    const turnoverCode: string | undefined = stat?.kategorieObratu;

    return NextResponse.json({
      ico: data?.ico ?? ico,
      name: data?.obchodniJmeno ?? null,
      legalForm: data?.pravniForma ?? null,
      dic: data?.dic ?? null,
      address: formatAddress(data?.sidlo),
      foundedAt: data?.datumVzniku ?? null,
      mainActivity:
        data?.czNace?.[0] ?? data?.seznamRegistraci?.stavZdrojeRes ?? null,
      employees: {
        code: employeeCode ?? null,
        label: employeeCode
          ? EMPLOYEE_CATEGORIES[employeeCode] ?? `Kód ${employeeCode}`
          : null,
      },
      turnover: {
        code: turnoverCode ?? null,
        label: turnoverCode
          ? TURNOVER_CATEGORIES[turnoverCode] ?? `Kód ${turnoverCode}`
          : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Nepodařilo se spojit s ARES." },
      { status: 502 }
    );
  }
}
