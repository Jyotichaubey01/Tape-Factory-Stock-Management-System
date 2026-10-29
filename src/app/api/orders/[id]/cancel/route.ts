import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelSalesOrder } from "@/lib/services/order-service";
import { cancelOrderSchema } from "@/lib/validations";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = cancelOrderSchema.parse({
      ...body,
      orderId: params.id,
    });

    const cancellation = await cancelSalesOrder({
      orderId: params.id,
      reason: parsed.reason,
      userId: user.id,
      userRole: user.role,
    });

    await logAuditEvent({
      action: "CANCEL_SALES_ORDER",
      entity: "Cancellation",
      entityId: String(cancellation.id),
      details: {
        orderId: params.id,
        releasedRolls: cancellation.rolls,
        reason: parsed.reason,
      },
      userId: user.id,
      userRole: user.role,
    });

    return NextResponse.json({
      success: true,
      cancellation: {
        id: String(cancellation.id),
        releasedRolls: cancellation.rolls,
        reason: cancellation.reason,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to cancel order" }, { status: 400 });
  }
}
