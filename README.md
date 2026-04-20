# Koncept CRM

Jednoduché CRM pro sledování oslovení firem. Trello-styl kanban, multi-user s rolemi, SQLite backend, Next.js.

## Tech stack

- **Next.js 14** (App Router, React 18, TypeScript) — jeden codebase pro frontend i API
- **Prisma + SQLite** — databáze v jednom souboru, žádný DB server
- **NextAuth.js** — autentizace pomocí e-mailu/hesla, JWT sessions, role (ADMIN/USER)
- **Tailwind CSS** — responzivní UI
- **@dnd-kit** — drag & drop mezi sloupci

## Folder structure

```
koncept-crm/
├── prisma/
│   ├── schema.prisma        # datový model (User, Company, Activity)
│   └── seed.ts              # inicializace DB (admin + demo data)
├── src/
│   ├── app/
│   │   ├── layout.tsx       # root layout
│   │   ├── page.tsx         # redirect na /board nebo /login
│   │   ├── globals.css      # Tailwind + utility třídy
│   │   ├── login/page.tsx   # přihlašovací stránka
│   │   ├── (app)/           # chráněná skupina (vyžaduje přihlášení)
│   │   │   ├── layout.tsx   # kontrola session + Navbar
│   │   │   ├── board/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   └── users/
│   │   │       ├── page.tsx
│   │   │       └── UsersClient.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── companies/
│   │       │   ├── route.ts            # GET list, POST create
│   │       │   ├── [id]/route.ts       # GET/PATCH/DELETE
│   │       │   ├── [id]/activities/route.ts
│   │       │   ├── reorder/route.ts    # drag&drop uložení
│   │       │   └── export/route.ts     # CSV export
│   │       ├── users/route.ts
│   │       ├── users/[id]/route.ts
│   │       └── stats/route.ts
│   ├── components/
│   │   ├── Providers.tsx
│   │   ├── Navbar.tsx
│   │   ├── Filters.tsx
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColumn.tsx
│   │   ├── CompanyCard.tsx
│   │   └── CompanyModal.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── guards.ts        # requireSession / requireAdmin
│   │   └── constants.ts     # kategorie, fáze, typy aktivit (CZ labels)
│   └── types/
│       ├── index.ts
│       └── next-auth.d.ts
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Funkce

- **Kanban nástěnka** — drag & drop mezi 6 fázemi, každý sloupec zobrazuje počet firem
- **Přidání/úprava/smazání firmy** — modal se všemi poli
- **Historie aktivit** — u každé firmy log (telefonát, e-mail, schůzka, poznámka, změna fáze) s datem a autorem
- **Dashboard** — souhrny: celkem firem, po fázích, po kategoriích, po termínu, nadcházející follow-upy
- **Filtrování + hledání** — podle kategorie a textu v názvu nebo IČO
- **CSV export** — exportuje aktuální filtrovaný pohled (UTF-8 BOM pro Excel, oddělovač `;`)
- **Auth + role** — přihlášení e-mailem/heslem, dvě role:
  - **Admin** — plný přístup, správa uživatelů
  - **User** — může prohlížet a upravovat firmy, bez přístupu ke správě uživatelů

Všechny UI texty jsou v češtině, layout je responzivní (mobile-first).

## Setup — lokální vývoj

```bash
# 1) instalace závislostí
npm install

# 2) environment proměnné
cp .env.example .env
# .env už je připravený s dev hodnotami. Pro produkci změňte NEXTAUTH_SECRET
# na dlouhý náhodný řetězec (min. 32 znaků), např.:
#   openssl rand -base64 48

# 3) vytvořit databázi + aplikovat schéma
npx prisma migrate dev --name init

# 4) naplnit seed (admin + demo firmy)
npm run db:seed

# 5) spustit dev server
npm run dev
```

Aplikace poběží na `http://localhost:3000`.

### Default admin přihlašovací údaje

Po seedu jsou v DB tyto účty:

| Role  | E-mail             | Heslo      |
| ----- | ------------------ | ---------- |
| Admin | `admin@koncept.cz` | `admin123` |
| User  | `user@koncept.cz`  | `user123`  |

**Po prvním přihlášení jako admin okamžitě změňte hesla v sekci Uživatelé → Reset hesla.**

## Užitečné skripty

```bash
npm run dev           # vývojový server s hot-reload
npm run build         # produkční build (spustí prisma generate + migrate deploy)
npm run start         # produkční server
npm run db:migrate    # vytvořit novou migraci po úpravě schema.prisma
npm run db:push       # aplikovat schema bez migrace (jen pro prototypy)
npm run db:seed       # znovu spustit seed
npm run db:studio     # GUI pro prohlížení DB (prisma studio)
```

## Deployment

### Varianta A — VPS (doporučeno, díky SQLite persistenci)

1. Nahrát repo na server (`git pull` nebo `scp`).
2. Nastavit `.env`:
   ```env
   DATABASE_URL="file:./prisma/prod.db"
   NEXTAUTH_SECRET="<openssl rand -base64 48>"
   NEXTAUTH_URL="https://vase-domena.cz"
   ```
3. Build a spuštění:
   ```bash
   npm ci
   npm run build
   npm run db:seed   # jen při prvním nasazení
   npm run start     # běží na portu 3000
   ```
4. Za něj reverse proxy (nginx/Caddy) + systemd service nebo `pm2`:
   ```bash
   pm2 start npm --name koncept-crm -- run start
   pm2 save
   pm2 startup
   ```
5. **Zálohy** — stačí pravidelně kopírovat `prisma/prod.db` (jeden soubor). Např. cron:
   ```
   0 3 * * * cp /app/prisma/prod.db /backup/koncept-$(date +\%F).db
   ```

### Varianta B — Docker

`Dockerfile` není součástí, ale díky `output: "standalone"` v `next.config.mjs` je deploy triviální:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

SQLite soubor mountněte jako volume (`-v crm-data:/app/prisma`), aby přežil restart.

### Varianta C — Vercel

Vercel je serverless a nemá persistent disk → SQLite nepůjde. Řešení: nahradit `DATABASE_URL` za [Turso](https://turso.tech/) (libSQL, kompatibilní s Prisma) nebo přejít na Postgres (Neon, Supabase) — v `schema.prisma` stačí změnit `provider = "postgresql"`, zbytek kódu funguje beze změn.

## Produkční checklist

- [ ] Vygenerovaný silný `NEXTAUTH_SECRET` (min. 32 znaků)
- [ ] `NEXTAUTH_URL` nastavený na vaši doménu (`https://…`)
- [ ] Změněná hesla výchozích uživatelů
- [ ] HTTPS (Caddy / nginx + Let's Encrypt)
- [ ] Pravidelná záloha `prisma/prod.db`

## Datový model (výběr)

- `User` — `id, email (unique), name, password (bcrypt), role`
- `Company` — `id, name, ico, contactPerson, phone, email, category, stage, notes, followUpDate, lastActivity, position`
- `Activity` — `id, companyId, userId, type, note, date` (logy ke konkrétní firmě, auto-záznam při změně fáze)

Kategorie: `TECHNICAL | LABORATORY | SECURITY | OTHER`  
Fáze: `NEW | CONTACTED | WAITING | NEGOTIATION | CLOSED | REJECTED`  
Typy aktivit: `CALL | EMAIL | MEETING | NOTE | STAGE_CHANGE`
