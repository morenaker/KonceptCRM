import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const userPassword = await bcrypt.hash("user123", 10);
  const teamPassword = await bcrypt.hash("heslo", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@koncept.cz" },
    update: {},
    create: {
      email: "admin@koncept.cz",
      name: "Administrátor",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "user@koncept.cz" },
    update: {},
    create: {
      email: "user@koncept.cz",
      name: "Uživatel",
      password: userPassword,
      role: "USER",
    },
  });

  const team = [
    { email: "ardolf@koncepthk.cz", name: "Ardolf" },
    { email: "stuchlik@koncepthk.cz", name: "Stuchlík" },
    { email: "rehak@koncepthk.cz", name: "Řehák" },
    { email: "monik@koncepthk.cz", name: "Moník" },
    { email: "mader@koncepthk.cz", name: "Mader" },
    { email: "maderova@koncepthk.cz", name: "Maderová" },
  ];
  for (const u of team) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: "ADMIN" },
      create: {
        email: u.email,
        name: u.name,
        password: teamPassword,
        role: "ADMIN",
      },
    });
  }

  const count = await prisma.company.count();
  if (count === 0) {
    const demos = [
      {
        name: "ABC Technical s.r.o.",
        ico: "12345678",
        contactPerson: "Jan Novák",
        phone: "+420 777 111 222",
        email: "novak@abctech.cz",
        category: "TECHNICAL",
        stage: "NEW",
        notes: "Doporučeno od partnera.",
      },
      {
        name: "LabCorp Praha",
        ico: "87654321",
        contactPerson: "Eva Svobodová",
        phone: "+420 602 333 444",
        email: "svobodova@labcorp.cz",
        category: "LABORATORY",
        stage: "CONTACTED",
        notes: "První e-mail odeslán, čekáme odpověď.",
        followUpDate: new Date(Date.now() + 3 * 86400_000),
      },
      {
        name: "SecureGuard a.s.",
        ico: "11223344",
        contactPerson: "Petr Dvořák",
        phone: "+420 603 555 666",
        email: "dvorak@secureguard.cz",
        category: "SECURITY",
        stage: "NEGOTIATION",
        notes: "Probíhá ladění smlouvy.",
        followUpDate: new Date(Date.now() - 2 * 86400_000),
      },
      {
        name: "Ostatní Služby s.r.o.",
        ico: "44332211",
        contactPerson: "Marie Králová",
        phone: "+420 604 777 888",
        email: "kralova@ostatni.cz",
        category: "OTHER",
        stage: "WAITING",
        notes: "Odpověď přislíbena do konce měsíce.",
      },
    ];

    for (const [i, d] of demos.entries()) {
      const c = await prisma.company.create({
        data: { ...d, position: i, lastActivity: new Date() },
      });
      await prisma.activity.create({
        data: {
          companyId: c.id,
          userId: admin.id,
          type: "NOTE",
          note: "Demo záznam vytvořen seedem.",
        },
      });
    }
  }

  console.log("Seed dokončen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
