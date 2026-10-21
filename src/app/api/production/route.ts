import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createProductionBatch } from "@/lib/services/production-service";
import { productionBatchSchema } from "@/lib/validations";
import { checkIdempotency, saveIdempotency } from "@/lib/idempotency";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batches = await prisma.productionBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      specification: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ batches });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, "/api/production", null);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  try {
    const body = await req.json();
    const parsed = productionBatchSchema.parse(body);

    const batch = await createProductionBatch({
      batchNumber: parsed.batchNumber,
      specificationId: parsed.specificationId,
      rollCount: parsed.rollCount,
      filmIssuedKg: parsed.filmIssuedKg,
      liquidAdhesiveIssuedKg: parsed.liquidAdhesiveIssuedKg,
      dryWastageKg: parsed.dryWastageKg,
      userId: user.id,
      userRole: user.role,
    });

    await logAuditEvent({
      action: "RECORD_PRODUCTION_BATCH",
      entity: "ProductionBatch",
      entityId: batch.id,
      details: {
        batchNumber: batch.batchNumber,
        rollCount: batch.rollCount,
        filmIssuedKg: batch.filmIssuedKg,
        liquidAdhesiveIssuedKg: batch.liquidAdhesiveIssuedKg,
      },
      userId: user.id,
      userRole: user.role,
    });

    const result = { success: true, batch };

    if (idempotencyKey) {
      await saveIdempotency(idempotencyKey, "/api/production", body, 201, result, user.id);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to record production batch" }, { status: 400 });
  }
}
