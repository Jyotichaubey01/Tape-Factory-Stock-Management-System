import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const datasourceUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: datasourceUrl
    ? {
        db: {
          url: datasourceUrl,
        },
      }
    : undefined,
});

async function main() {
  console.log("Starting database seed against Aiven MySQL...");

  // 1. Seed Demo Users
  const adminPasswordHash = await bcrypt.hash("AdminDemo@2026", 12);
  const staffPasswordHash = await bcrypt.hash("StaffDemo@2026", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@tape.local" },
    update: {
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      name: "Factory Administrator",
    },
    create: {
      email: "admin@tape.local",
      passwordHash: adminPasswordHash,
      name: "Factory Administrator",
      role: Role.ADMIN,
    },
  });
  console.log(`✓ Admin user verified/seeded: ${adminUser.email}`);

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@tape.local" },
    update: {
      passwordHash: staffPasswordHash,
      role: Role.STAFF,
      name: "Floor Operator",
    },
    create: {
      email: "staff@tape.local",
      passwordHash: staffPasswordHash,
      name: "Floor Operator",
      role: Role.STAFF,
    },
  });
  console.log(`✓ Staff user verified/seeded: ${staffUser.email}`);

  // 2. Seed Standard Tape Specification (48mm, 25 GSM film, 22 GSM dry adhesive, 50% solids, 1000m roll length)
  const standardSpec = await prisma.tapeSpecification.upsert({
    where: { code: "SPEC-48-1000-STD" },
    update: {
      widthMm: 48,
      filmGsm: 25,
      dryAdhesiveGsm: 22,
      solidsPercent: 50,
      rollLengthM: 1000,
    },
    create: {
      code: "SPEC-48-1000-STD",
      widthMm: 48,
      filmGsm: 25,
      dryAdhesiveGsm: 22,
      solidsPercent: 50,
      rollLengthM: 1000,
    },
  });
  console.log(`✓ Tape specification verified/seeded: ${standardSpec.code}`);

  // Also ensure existing 'TF-48-25' has proper parameters
  await prisma.tapeSpecification.upsert({
    where: { code: "TF-48-25" },
    update: {
      widthMm: 48,
      filmGsm: 25,
      dryAdhesiveGsm: 22,
      solidsPercent: 50,
      rollLengthM: 1000,
    },
    create: {
      code: "TF-48-25",
      widthMm: 48,
      filmGsm: 25,
      dryAdhesiveGsm: 22,
      solidsPercent: 50,
      rollLengthM: 1000,
    },
  });

  // 3. Seed Customers
  const dummyCustomers = [
    {
      name: "Alpha Packaging Solutions",
      email: "orders@alphapack.in",
      userId: adminUser.id,
    },
    {
      name: "Apex Logistics Corp",
      email: "procurement@apexlogistics.com",
      userId: adminUser.id,
    },
  ];

  for (const c of dummyCustomers) {
    const existing = await prisma.customer.findFirst({
      where: { name: c.name },
    });
    if (!existing) {
      await prisma.customer.create({ data: c });
      console.log(`✓ Customer seeded: ${c.name}`);
    } else {
      console.log(`✓ Customer exists: ${c.name}`);
    }
  }

  console.log("Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
