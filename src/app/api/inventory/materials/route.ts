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

  const mappedLedger = ledger.map((l) => ({
    id: String(l.id),
    materialType: l.material === "ADHESIVE" ? "LIQUID_ADHESIVE" : l.material === "CORES" ? "CORE" : "FILM",
    transactionType: l.type,
    quantity: Number(l.quantity),
    unit: l.material === "CORES" ? "PCS" : "KG",
    referenceId: l.reference,
    notes: l.reason || "",
    createdAt: l.createdAt,
    user: l.user,
  }));

  return NextResponse.json({ balances, ledger: mappedLedger });
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

    const dbMaterial =
      parsed.materialType === "LIQUID_ADHESIVE"
        ? "ADHESIVE"
        : parsed.materialType === "CORE"
        ? "CORES"
        : "FILM";

    const record = await receiveRawMaterial({
      materialType: dbMaterial as any,
      quantity: parsed.quantity,
      notes: parsed.notes,
      userId: user.id,
    });

    await logAuditEvent({
      action: "RECEIVE_RAW_MATERIAL",
      entity: "MaterialLedger",
      entityId: String(record.id),
      details: { material: dbMaterial, quantity: parsed.quantity },
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
