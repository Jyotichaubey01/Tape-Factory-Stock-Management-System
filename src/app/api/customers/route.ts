import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
  });

  const mapped = customers.map((c) => ({
    id: String(c.id),
    code: `CUST-${String(c.id).padStart(3, "0")}`,
    name: c.name,
    email: c.email || "",
    contactPerson: "",
    phone: "",
    address: "",
    createdAt: c.createdAt,
  }));

  return NextResponse.json({ customers: mapped });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        email: body.email || null,
        userId: parseInt(user.id, 10) || 1,
      },
    });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create customer" }, { status: 400 });
  }
}
