import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { parseOrderQuantity } from "../bom";
import { getFinishedGoodsBalances } from "./stock-service";
import { logAuditEvent } from "../audit";

export interface CreateOrderInput {
  customerId: string;
  specificationId: string;
  unit: "ROLLS" | "METRES" | "NET_KG";
  quantity: number;
  notes?: string;
  userId: string;
  userRole: string;
}

export async function createSalesOrder(input: CreateOrderInput) {
  // 1. Fetch Specification
  const spec = await prisma.tapeSpecification.findUnique({
    where: { id: input.specificationId },
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
      dryCoatingGsm: spec.dryCoatingGsm.toString(),
      adhesiveSolidsPercent: spec.adhesiveSolidsPercent.toString(),
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

    // Create Sales Order with reserved rolls = rollsToOrder
    const order = await tx.salesOrder.create({
      data: {
        orderNumber,
        customerId: input.customerId,
        specificationId: input.specificationId,
        orderedUnit: input.unit,
        originalInputQuantity: new Decimal(input.quantity).toNumber(),
        orderedRolls: rollsToOrder,
        reservedRolls: rollsToOrder,
        dispatchedRolls: 0,
        cancelledRolls: 0,
        status: "CONFIRMED",
        notes: input.notes || null,
        createdById: input.userId,
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
        specificationId: spec.id,
        reservedRolls: rollsToOrder,
        releasedRolls: 0,
        dispatchedRolls: 0,
        status: "ACTIVE",
      },
    });

    return order;
  });
}

/**
 * Dispatch whole rolls against an active order.
 * Can be partial or full. Must never exceed unshipped order balance.
 */
export async function dispatchOrder(params: {
  orderId: string;
  rollCount: number;
  notes?: string;
  userId: string;
  userRole: string;
}) {
  if (params.rollCount <= 0 || !Number.isInteger(params.rollCount)) {
    throw new Error("Dispatch roll count must be a positive whole integer");
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({
      where: { id: params.orderId },
      include: { specification: true },
    });

    if (!order) {
      throw new Error(`Order "${params.orderId}" not found.`);
    }

    if (order.status === "CANCELLED" || order.status === "FULFILLED") {
      throw new Error(`Cannot dispatch against an order with status "${order.status}".`);
    }

    const unshippedBalance = order.orderedRolls - order.dispatchedRolls - order.cancelledRolls;
    if (params.rollCount > unshippedBalance) {
      throw new Error(
        `Dispatch rejected: requested ${params.rollCount} rolls exceeds remaining unshipped balance of ${unshippedBalance} rolls.`
      );
    }

    // Generate unique dispatch number
    const dispatchCount = await tx.dispatch.count();
    const dispatchNumber = `DSP-${new Date().getFullYear()}-${String(dispatchCount + 1).padStart(5, "0")}`;

    // Create Dispatch record
    const dispatch = await tx.dispatch.create({
      data: {
        dispatchNumber,
        orderId: order.id,
        rollCount: params.rollCount,
        notes: params.notes || null,
        createdById: params.userId,
      },
    });

    const newDispatchedRolls = order.dispatchedRolls + params.rollCount;
    const newReservedRolls = order.reservedRolls - params.rollCount;
    const isFullyShipped = newDispatchedRolls + order.cancelledRolls >= order.orderedRolls;
    const newStatus = isFullyShipped ? "FULFILLED" : "PARTIALLY_DISPATCHED";

    // Update SalesOrder
    await tx.salesOrder.update({
      where: { id: order.id },
      data: {
        dispatchedRolls: newDispatchedRolls,
        reservedRolls: Math.max(0, newReservedRolls),
        status: newStatus,
      },
    });

    // Update OrderReservation
    const reservation = await tx.orderReservation.findFirst({
      where: { orderId: order.id, status: "ACTIVE" },
    });

    if (reservation) {
      const updatedDispatched = reservation.dispatchedRolls + params.rollCount;
      const allResolved =
        updatedDispatched + reservation.releasedRolls >= reservation.reservedRolls;

      await tx.orderReservation.update({
        where: { id: reservation.id },
        data: {
          dispatchedRolls: updatedDispatched,
          status: allResolved ? "FULFILLED" : "ACTIVE",
        },
      });
    }

    // Physical stock deduction from FinishedGoodsLedger
    const rollLenM = new Decimal(order.specification.rollLengthM.toString());
    const metres = rollLenM.mul(params.rollCount);
    // BOM for 1 roll to get netTapeKg
    const areaM2PerRoll = new Decimal(order.specification.widthMm.toString())
      .div(1000)
      .mul(rollLenM);
    const filmKgPerRoll = areaM2PerRoll.mul(order.specification.filmGsm.toString()).div(1000);
    const dryAdhKgPerRoll = areaM2PerRoll.mul(order.specification.dryCoatingGsm.toString()).div(1000);
    const netKgPerRoll = filmKgPerRoll.plus(dryAdhKgPerRoll);
    const totalNetKg = netKgPerRoll.mul(params.rollCount);

    await tx.finishedGoodsLedger.create({
      data: {
        specificationId: order.specificationId,
        transactionType: "ORDER_DISPATCH",
        rollCount: -params.rollCount,
        netTapeKg: totalNetKg.negated().toNumber(),
        metres: metres.negated().toNumber(),
        referenceType: "ORDER_DISPATCH",
        referenceId: dispatch.dispatchNumber,
        notes: `Dispatch ${dispatch.dispatchNumber} for ${order.orderNumber}`,
        userId: params.userId,
      },
    });

    return dispatch;
  });
}

/**
 * Cancel the remaining unshipped balance of an order.
 * Releases only the remaining unshipped reservation back to available stock.
 */
export async function cancelSalesOrder(params: {
  orderId: string;
  reason: string;
  userId: string;
  userRole: string;
}) {
  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error("Cancellation reason must be at least 5 characters long");
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({
      where: { id: params.orderId },
    });

    if (!order) {
      throw new Error(`Order "${params.orderId}" not found.`);
    }

    if (order.status === "CANCELLED" || order.status === "FULFILLED") {
      throw new Error(`Cannot cancel order in "${order.status}" status.`);
    }

    const remainingUnshipped = order.orderedRolls - order.dispatchedRolls - order.cancelledRolls;
    if (remainingUnshipped <= 0) {
      throw new Error("No unshipped rolls remain to cancel for this order.");
    }

    // Record Cancellation
    const cancellation = await tx.cancellation.create({
      data: {
        orderId: order.id,
        releasedRolls: remainingUnshipped,
        reason: params.reason,
        createdById: params.userId,
      },
    });

    // Update SalesOrder: cancelledRolls increases, reservedRolls decreases to 0
    const newStatus = order.dispatchedRolls > 0 ? "PARTIALLY_DISPATCHED" : "CANCELLED";
    await tx.salesOrder.update({
      where: { id: order.id },
      data: {
        cancelledRolls: order.cancelledRolls + remainingUnshipped,
        reservedRolls: 0,
        status: newStatus,
      },
    });

    // Release reservation
    const reservation = await tx.orderReservation.findFirst({
      where: { orderId: order.id, status: "ACTIVE" },
    });

    if (reservation) {
      await tx.orderReservation.update({
        where: { id: reservation.id },
        data: {
          releasedRolls: reservation.releasedRolls + remainingUnshipped,
          status: "RELEASED",
        },
      });
    }

    return cancellation;
  });
}
