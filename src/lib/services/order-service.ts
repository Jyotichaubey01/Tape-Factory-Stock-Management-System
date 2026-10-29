import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { parseOrderQuantity } from "../bom";
import { getFinishedGoodsBalances } from "./stock-service";

export interface CreateOrderInput {
  customerId: number | string;
  specificationId: number | string;
  unit: "ROLLS" | "METRES" | "NET_KG";
  quantity: number;
  notes?: string;
  userId: number | string;
  userRole: string;
}

export async function createSalesOrder(input: CreateOrderInput) {
  const specId = typeof input.specificationId === "number" ? input.specificationId : parseInt(String(input.specificationId), 10);
  const custId = typeof input.customerId === "number" ? input.customerId : parseInt(String(input.customerId), 10);
  const numericUserId = typeof input.userId === "number" ? input.userId : parseInt(String(input.userId), 10) || 1;

  // 1. Fetch Specification
  const spec = await prisma.tapeSpecification.findUnique({
    where: { id: specId },
  });

  if (!spec) {
    throw new Error(`Specification "${input.specificationId}" not found.`);
  }

  // 2. Parse & Validate Order Quantity into Whole Rolls
  const parsed = parseOrderQuantity(
    input.unit,
    input.quantity,
    {
      widthMm: spec.widthMm.toString(),
      filmGsm: spec.filmGsm.toString(),
      dryCoatingGsm: spec.dryAdhesiveGsm.toString(),
      adhesiveSolidsPercent: spec.solidsPercent.toString(),
      rollLengthM: spec.rollLengthM.toString(),
    }
  );

  if (!parsed.isValid) {
    const errorDetails = {
      message: parsed.error,
      suggestedAlternatives: parsed.alternatives || [],
    };
    const err = new Error(parsed.error);
    (err as any).details = errorDetails;
    throw err;
  }

  const rollsToOrder = parsed.orderedRolls;

  // 3. Concurrency-safe Prisma interactive transaction
  return await prisma.$transaction(async (tx) => {
    // Check available finished goods stock for this specification
    const fgSummaries = await getFinishedGoodsBalances(tx);
    const specStock = fgSummaries.find((s) => s.specificationId === spec.id);
    const availableRolls = specStock ? specStock.availableRolls : 0;

    if (availableRolls < rollsToOrder) {
      const shortage = rollsToOrder - availableRolls;
      throw new Error(
        `Insufficient available finished goods stock. Requested: ${rollsToOrder} rolls, Currently Available: ${availableRolls} rolls (Shortage: ${shortage} rolls).`
      );
    }

    // Generate unique order number
    const count = await tx.salesOrder.count();
    const orderNumber = `SO-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    // Create Sales Order
    const order = await tx.salesOrder.create({
      data: {
        orderNumber,
        customerId: custId,
        specificationId: specId,
        orderedRolls: rollsToOrder,
        dispatchedRolls: 0,
        cancelledRolls: 0,
        userId: numericUserId,
      },
      include: {
        customer: true,
        specification: true,
      },
    });

    // Create Order Reservation record
    await tx.orderReservation.create({
      data: {
        orderId: order.id,
        event: "RESERVE",
        rolls: rollsToOrder,
        userId: numericUserId,
      },
    });

    return order;
  });
}

/**
 * Dispatch whole rolls against an active order.
 */
export async function dispatchOrder(params: {
  orderId: number | string;
  rollCount: number;
  notes?: string;
  userId: number | string;
  userRole: string;
}) {
  const orderId = typeof params.orderId === "number" ? params.orderId : parseInt(String(params.orderId), 10);
  const numericUserId = typeof params.userId === "number" ? params.userId : parseInt(String(params.userId), 10) || 1;

  if (params.rollCount <= 0 || !Number.isInteger(params.rollCount)) {
    throw new Error("Dispatch roll count must be a positive whole integer");
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: { specification: true },
    });

    if (!order) {
      throw new Error(`Order "${params.orderId}" not found.`);
    }

    const unshippedBalance = order.orderedRolls - order.dispatchedRolls - order.cancelledRolls;
    if (params.rollCount > unshippedBalance) {
      throw new Error(
        `Dispatch rejected: requested ${params.rollCount} rolls exceeds remaining unshipped balance of ${unshippedBalance} rolls.`
      );
    }

    const dispatchCount = await tx.dispatch.count();
    const dispatchNumber = `DSP-${new Date().getFullYear()}-${String(dispatchCount + 1).padStart(5, "0")}`;

    // Create Dispatch record
    const dispatch = await tx.dispatch.create({
      data: {
        reference: dispatchNumber,
        orderId: order.id,
        rolls: params.rollCount,
        userId: numericUserId,
      },
    });

    const newDispatchedRolls = order.dispatchedRolls + params.rollCount;

    // Update SalesOrder
    await tx.salesOrder.update({
      where: { id: order.id },
      data: {
        dispatchedRolls: newDispatchedRolls,
      },
    });

    // Create OrderReservation record for dispatch event
    await tx.orderReservation.create({
      data: {
        orderId: order.id,
        event: "DISPATCH",
        rolls: params.rollCount,
        userId: numericUserId,
      },
    });

    // Physical stock deduction from FinishedGoodsLedger
    await tx.finishedGoodsLedger.create({
      data: {
        specificationId: order.specificationId,
        deltaRolls: -params.rollCount,
        type: "DISPATCH",
        reference: dispatch.reference,
        reason: `Dispatch ${dispatch.reference} for ${order.orderNumber}`,
        userId: numericUserId,
        orderId: order.id,
      },
    });

    return dispatch;
  });
}

/**
 * Cancel the remaining unshipped balance of an order.
 */
export async function cancelSalesOrder(params: {
  orderId: number | string;
  reason: string;
  userId: number | string;
  userRole: string;
}) {
  const orderId = typeof params.orderId === "number" ? params.orderId : parseInt(String(params.orderId), 10);
  const numericUserId = typeof params.userId === "number" ? params.userId : parseInt(String(params.userId), 10) || 1;

  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error("Cancellation reason must be at least 5 characters long");
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order "${params.orderId}" not found.`);
    }

    const remainingUnshipped = order.orderedRolls - order.dispatchedRolls - order.cancelledRolls;
    if (remainingUnshipped <= 0) {
      throw new Error("No unshipped rolls remain to cancel for this order.");
    }

    // Record Cancellation
    const cancellation = await tx.cancellation.create({
      data: {
        orderId: order.id,
        rolls: remainingUnshipped,
        reason: params.reason,
        userId: numericUserId,
      },
    });

    // Update SalesOrder: cancelledRolls increases
    await tx.salesOrder.update({
      where: { id: order.id },
      data: {
        cancelledRolls: order.cancelledRolls + remainingUnshipped,
      },
    });

    // Record reservation release event
    await tx.orderReservation.create({
      data: {
        orderId: order.id,
        event: "RELEASE",
        rolls: remainingUnshipped,
        userId: numericUserId,
      },
    });

    return cancellation;
  });
}
