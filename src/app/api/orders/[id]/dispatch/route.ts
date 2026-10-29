import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dispatchOrder } from "@/lib/services/order-service";
import { dispatchSchema } from "@/lib/validations";
import { checkIdempotency, saveIdempotency } from "@/lib/idempotency";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, `/api/orders/${params.id}/dispatch`, null);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  try {
    const body = await req.json();
    const parsed = dispatchSchema.parse({
      ...body,
      orderId: params.id,
    });

    const dispatch = await dispatchOrder({
      orderId: params.id,
      rollCount: parsed.rollCount,
      notes: parsed.notes,
      userId: user.id,
      userRole: user.role,
    });

    await logAuditEvent({
      action: "DISPATCH_ORDER",
      entity: "Dispatch",
      entityId: String(dispatch.id),
      details: {
        dispatchReference: dispatch.reference,
        orderId: params.id,
        rolls: parsed.rollCount,
      },
      userId: user.id,
      userRole: user.role,
    });

    const result = {
      success: true,
      dispatch: {
        id: String(dispatch.id),
        dispatchNumber: dispatch.reference,
        rollCount: dispatch.rolls,
      },
    };

    if (idempotencyKey) {
      await saveIdempotency(idempotencyKey, `/api/orders/${params.id}/dispatch`, body, 201, result, user.id);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to dispatch order" }, { status: 400 });
  }
}
