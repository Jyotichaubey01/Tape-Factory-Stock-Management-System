import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getMaterialBalances, receiveRawMaterial } from "@/lib/services/stock-service";
import { materialReceiptSchema } from "@/lib/validations";
import { checkIdempotency, saveIdempotency } from "@/lib/idempotency";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const balances = await getMaterialBalances();

  const ledger = await prisma.materialLedger.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ balances, ledger });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, "/api/inventory/materials", null);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  try {
    const body = await req.json();
    const parsed = materialReceiptSchema.parse(body);

    const record = await receiveRawMaterial({
      materialType: parsed.materialType,
      quantity: parsed.quantity,
      notes: parsed.notes,
      userId: user.id,
    });

    await logAuditEvent({
      action: "RECEIVE_RAW_MATERIAL",
      entity: "MaterialLedger",
      entityId: record.id,
      details: { materialType: parsed.materialType, quantity: parsed.quantity },
      userId: user.id,
      userRole: user.role,
    });

    const result = { success: true, record };

    if (idempotencyKey) {
      await saveIdempotency(idempotencyKey, "/api/inventory/materials", body, 201, result, user.id);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to receive material" }, { status: 400 });
  }
}
