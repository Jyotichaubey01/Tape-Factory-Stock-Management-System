import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { MaterialBalanceSummary, FinishedGoodsSummary } from "../types";
import { calculateBOM } from "../bom";
import { Prisma } from "@prisma/client";

type PrismaTx = Prisma.TransactionClient;

/**
 * Get current on-hand raw material balances from the append-only MaterialLedger.
 * Negative balances are strictly impossible by business invariant.
 */
export async function getMaterialBalances(tx?: PrismaTx): Promise<MaterialBalanceSummary> {
  const db = tx || prisma;
  const sums = await db.materialLedger.groupBy({
    by: ["materialType"],
    _sum: {
      quantity: true,
    },
  });

  let filmKg = new Decimal(0);
  let liquidAdhesiveKg = new Decimal(0);
  let coresPcs = new Decimal(0);

  for (const s of sums) {
    const qty = new Decimal(s._sum.quantity?.toString() || "0");
    if (s.materialType === "FILM") filmKg = qty;
    if (s.materialType === "LIQUID_ADHESIVE") liquidAdhesiveKg = qty;
    if (s.materialType === "CORE") coresPcs = qty;
  }

  return {
    filmKg: Math.max(0, filmKg.toNumber()),
    liquidAdhesiveKg: Math.max(0, liquidAdhesiveKg.toNumber()),
    coresPcs: Math.max(0, coresPcs.toNumber()),
  };
}

/**
 * Receive raw materials into inventory (append-only ledger).
 */
export async function receiveRawMaterial(params: {
  materialType: "FILM" | "LIQUID_ADHESIVE" | "CORE";
  quantity: number;
  notes?: string;
  userId: string;
  tx?: PrismaTx;
}) {
  const db = params.tx || prisma;
  const qty = new Decimal(params.quantity);
  if (qty.lte(0)) {
    throw new Error("Received quantity must be strictly greater than 0");
  }

  const unit = params.materialType === "CORE" ? "PCS" : "KG";

  return db.materialLedger.create({
    data: {
      materialType: params.materialType,
      transactionType: "RECEIPT",
      quantity: qty.toNumber(),
      unit,
      referenceType: "MANUAL_RECEIPT",
      notes: params.notes || "Stock arrival receipt",
      userId: params.userId,
    },
  });
}

/**
 * Record raw material damage or scrapping.
 * Rejects if stock is insufficient, showing the exact shortage.
 */
export async function recordMaterialDamage(params: {
  materialType: "FILM" | "LIQUID_ADHESIVE" | "CORE";
  quantity: number;
  notes: string;
  userId: string;
  tx?: PrismaTx;
}) {
  const execute = async (db: PrismaTx) => {
    const balances = await getMaterialBalances(db);
    const qty = new Decimal(params.quantity);
    if (qty.lte(0)) {
      throw new Error("Damage quantity must be strictly greater than 0");
    }

    let currentStock = new Decimal(0);
    let unit = "KG";
    if (params.materialType === "FILM") currentStock = new Decimal(balances.filmKg);
    if (params.materialType === "LIQUID_ADHESIVE") currentStock = new Decimal(balances.liquidAdhesiveKg);
    if (params.materialType === "CORE") {
      currentStock = new Decimal(balances.coresPcs);
      unit = "PCS";
    }

    if (currentStock.lt(qty)) {
      const shortage = qty.minus(currentStock);
      throw new Error(
        `Insufficient stock for damage recording. Available: ${currentStock.toFixed(3)} ${unit}, Requested: ${qty.toFixed(3)} ${unit}, Shortage: ${shortage.toFixed(3)} ${unit}`
      );
    }

    return db.materialLedger.create({
      data: {
        materialType: params.materialType,
        transactionType: "DAMAGE",
        quantity: qty.negated().toNumber(),
        unit: params.materialType === "CORE" ? "PCS" : "KG",
        referenceType: "DAMAGE_REPORT",
        notes: params.notes,
        userId: params.userId,
      },
    });
  };

  if (params.tx) {
    return execute(params.tx);
  }
  return prisma.$transaction((tx) => execute(tx));
}

/**
 * Get finished goods stock summary per specification.
 * Distinguishes on-hand physical rolls, active reservations, and net available to promise.
 */
export async function getFinishedGoodsBalances(tx?: PrismaTx): Promise<FinishedGoodsSummary[]> {
  const db = tx || prisma;
  const specs = await db.tapeSpecification.findMany({
    orderBy: { createdAt: "desc" },
  });

  const summaries: FinishedGoodsSummary[] = [];

  for (const spec of specs) {
    // Physical on-hand rolls = sum of FinishedGoodsLedger rollCount
    const fgSum = await db.finishedGoodsLedger.aggregate({
      where: { specificationId: spec.id },
      _sum: {
        rollCount: true,
      },
    });
    const onHandRolls = fgSum._sum.rollCount || 0;

    // Active reserved rolls = sum of active reservations (reservedRolls - releasedRolls - dispatchedRolls)
    const activeReservations = await db.orderReservation.findMany({
      where: {
        specificationId: spec.id,
        status: "ACTIVE",
      },
    });

    let reservedRolls = 0;
    for (const res of activeReservations) {
      const pending = res.reservedRolls - res.releasedRolls - res.dispatchedRolls;
      if (pending > 0) reservedRolls += pending;
    }

    const availableRolls = Math.max(0, onHandRolls - reservedRolls);

    const bom1 = calculateBOM(
      {
        widthMm: spec.widthMm.toString(),
        filmGsm: spec.filmGsm.toString(),
        dryCoatingGsm: spec.dryCoatingGsm.toString(),
        adhesiveSolidsPercent: spec.adhesiveSolidsPercent.toString(),
        rollLengthM: spec.rollLengthM.toString(),
      },
      availableRolls > 0 ? availableRolls : 1
    );

    const netTapeKg = availableRolls > 0 ? bom1.netTapeKg.toNumber() : 0;
    const metres = availableRolls > 0 ? bom1.totalMetres.toNumber() : 0;

    summaries.push({
      specificationId: spec.id,
      specificationCode: spec.code,
      onHandRolls,
      reservedRolls,
      availableRolls,
      metres,
      netTapeKg,
    });
  }

  return summaries;
}
