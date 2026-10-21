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
  console.log("Starting database seed...");

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
  console.log(`✓ Admin user seeded: ${adminUser.email}`);

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
  console.log(`✓ Staff user seeded: ${staffUser.email}`);

  // 2. Seed Standard Tape Specification
  // Width: 48 mm, Film GSM: 25, Dry coating GSM: 22, Adhesive solids: 50%, Roll length: 1,000 metres
  const standardSpec = await prisma.tapeSpecification.upsert({
    where: { code: "SPEC-48-1000-STD" },
    update: {
      widthMm: 48,
      filmGsm: 25,
      dryCoatingGsm: 22,
      adhesiveSolidsPercent: 50,
      rollLengthM: 1000,
    },
    create: {
      code: "SPEC-48-1000-STD",
      version: 1,
      widthMm: 48,
      filmGsm: 25,
      dryCoatingGsm: 22,
      adhesiveSolidsPercent: 50,
      rollLengthM: 1000,
      createdById: adminUser.id,
      isUsedForProduction: false,
    },
  });
  console.log(`✓ Tape specification seeded: ${standardSpec.code}`);

  // 3. Seed Dummy Customers
  const dummyCustomers = [
    {
      code: "CUST-ALPHA",
      name: "Alpha Packaging Solutions",
      contactPerson: "Rajesh Sharma",
      email: "rajesh@alphapack.in",
      phone: "+91 98765 43210",
      address: "Plot 14, Industrial Area Phase 1, Gurugram, Haryana",
    },
    {
      code: "CUST-APEX",
      name: "Apex Logistics & Cargo",
      contactPerson: "Anita Patel",
      email: "anita.p@apexlogistics.com",
      phone: "+91 98111 22334",
      address: "Warehouse 8B, Transport Nagar, Bhiwandi, Maharashtra",
    },
    {
      code: "CUST-GLOBAL",
      name: "Global Freight Supplies",
      contactPerson: "Vikram Malhotra",
      email: "procurement@globalfreight.net",
      phone: "+91 99222 33445",
      address: "Unit 3, Logistics Park, Peenya, Bengaluru, Karnataka",
    },
  ];

  for (const c of dummyCustomers) {
    const cust = await prisma.customer.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
    console.log(`✓ Customer seeded: ${cust.name} (${cust.code})`);
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
