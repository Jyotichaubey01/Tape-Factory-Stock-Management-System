import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createSalesOrder } from "@/lib/services/order-service";
import { salesOrderSchema } from "@/lib/validations";
import { checkIdempotency, saveIdempotency } from "@/lib/idempotency";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.salesOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      specification: true,
      users: {
        select: { id: true, name: true, email: true },
      },
      dispatches: true,
      cancellations: true,
    },
  });

  const mappedOrders = orders.map((o) => {
    const isFulfilled = o.dispatchedRolls >= o.orderedRolls;
    const isCancelled = o.cancelledRolls >= o.orderedRolls;
    const isPartial = o.dispatchedRolls > 0;
    const status = isFulfilled
      ? "FULFILLED"
      : isCancelled
      ? "CANCELLED"
      : isPartial
      ? "PARTIALLY_DISPATCHED"
      : "CONFIRMED";

    const reserved = Math.max(0, o.orderedRolls - o.dispatchedRolls - o.cancelledRolls);

    return {
      id: String(o.id),
      orderNumber: o.orderNumber,
      orderedUnit: "ROLLS",
      originalInputQuantity: o.orderedRolls,
      orderedRolls: o.orderedRolls,
      reservedRolls: reserved,
      dispatchedRolls: o.dispatchedRolls,
      cancelledRolls: o.cancelledRolls,
      status,
      createdAt: o.createdAt,
      customer: {
        name: o.customer.name,
        code: `CUST-${String(o.customer.id).padStart(3, "0")}`,
      },
      specification: {
        code: o.specification.code,
        rollLengthM: Number(o.specification.rollLengthM),
      },
      createdBy: o.users,
      dispatches: o.dispatches.map((d) => ({
        id: String(d.id),
        dispatchNumber: d.reference,
        rollCount: d.rolls,
        createdAt: d.createdAt,
      })),
      cancellations: o.cancellations,
    };
  });

  return NextResponse.json({ orders: mappedOrders });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, "/api/orders", null);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  try {
    const body = await req.json();
    const parsed = salesOrderSchema.parse(body);

    const order = await createSalesOrder({
      customerId: parsed.customerId,
      specificationId: parsed.specificationId,
      unit: parsed.unit,
      quantity: parsed.quantity,
      notes: parsed.notes,
      userId: user.id,
      userRole: user.role,
    });

    await logAuditEvent({
      action: "CREATE_SALES_ORDER",
      entity: "SalesOrder",
      entityId: String(order.id),
      details: {
        orderNumber: order.orderNumber,
        orderedRolls: order.orderedRolls,
        unit: parsed.unit,
        inputQty: parsed.quantity,
      },
      userId: user.id,
      userRole: user.role,
    });

    const result = { success: true, order };

    if (idempotencyKey) {
      await saveIdempotency(idempotencyKey, "/api/orders", body, 201, result, user.id);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Failed to create sales order",
        details: error.details,
      },
      { status: 400 }
    );
  }
}
