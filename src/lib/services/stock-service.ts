import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { MaterialBalanceSummary, FinishedGoodsSummary } from "../types";
import { calculateBOM } from "../bom";
import { Prisma, material_ledger_material, material_ledger_type } from "@prisma/client";

type PrismaTx = Prisma.TransactionClient;

/**
 * Get current on-hand raw material balances from the append-only MaterialLedger.
 */
export async function getMaterialBalances(tx?: PrismaTx): Promise<MaterialBalanceSummary> {
  const db = tx || prisma;
  const sums = await db.materialLedger.groupBy({
    by: ["material"],
    _sum: {
      quantity: true,
    },
  });

  let filmKg = new Decimal(0);
  let liquidAdhesiveKg = new Decimal(0);
  let coresPcs = new Decimal(0);

  for (const s of sums) {
    const qty = new Decimal(s._sum?.quantity?.toString() || "0");
    if (s.material === "FILM") filmKg = qty;
    if (s.material === "ADHESIVE") liquidAdhesiveKg = qty;
    if (s.material === "CORES") coresPcs = qty;
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
  materialType: "FILM" | "ADHESIVE" | "CORES";
  quantity: number;
  notes?: string;
  userId: string | number;
  tx?: PrismaTx;
}) {
  const db = params.tx || prisma;
  const qty = new Decimal(params.quantity);
  if (qty.lte(0)) {
    throw new Error("Received quantity must be strictly greater than 0");
  }

  const numericUserId =
    typeof params.userId === "number" ? params.userId : parseInt(params.userId, 10) || 1;

  return db.materialLedger.create({
    data: {
      material: params.materialType as material_ledger_material,
      type: "RECEIPT" as material_ledger_type,
      quantity: qty.toNumber(),
      reference: `RECEIPT-${Date.now()}`,
      reason: params.notes || "Stock arrival receipt",
      userId: numericUserId,
    },
  });
}

/**
 * Record raw material damage or scrapping.
 */
export async function recordMaterialDamage(params: {
  materialType: "FILM" | "ADHESIVE" | "CORES";
  quantity: number;
  notes: string;
  userId: string | number;
  tx?: PrismaTx;
}) {
  const execute = async (db: PrismaTx) => {
    const balances = await getMaterialBalances(db);
    const qty = new Decimal(params.quantity);
    if (qty.lte(0)) {
      throw new Error("Damage quantity must be strictly greater than 0");
    }

    let currentStock = new Decimal(0);
    const unit = params.materialType === "CORES" ? "PCS" : "KG";
    if (params.materialType === "FILM") currentStock = new Decimal(balances.filmKg);
    if (params.materialType === "ADHESIVE") currentStock = new Decimal(balances.liquidAdhesiveKg);
    if (params.materialType === "CORES") currentStock = new Decimal(balances.coresPcs);

    if (currentStock.lt(qty)) {
      const shortage = qty.minus(currentStock);
      throw new Error(
        `Insufficient stock for damage recording. Available: ${currentStock.toFixed(3)} ${unit}, Requested: ${qty.toFixed(3)} ${unit}, Shortage: ${shortage.toFixed(3)} ${unit}`
      );
    }

    const numericUserId =
      typeof params.userId === "number" ? params.userId : parseInt(params.userId, 10) || 1;

    return db.materialLedger.create({
      data: {
        material: params.materialType as material_ledger_material,
        type: "DAMAGE" as material_ledger_type,
        quantity: qty.negated().toNumber(),
        reference: `DAMAGE-${Date.now()}`,
        reason: params.notes,
        userId: numericUserId,
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
 */
export async function getFinishedGoodsBalances(tx?: PrismaTx): Promise<FinishedGoodsSummary[]> {
  const db = tx || prisma;
  const specs = await db.tapeSpecification.findMany({
    orderBy: { createdAt: "desc" },
  });

  const summaries: FinishedGoodsSummary[] = [];

  for (const spec of specs) {
    // Physical on-hand rolls = sum of deltaRolls from finished_goods_ledger
    const fgSum = await db.finishedGoodsLedger.aggregate({
      where: { specificationId: spec.id },
      _sum: {
        deltaRolls: true,
      },
    });
    const onHandRolls = fgSum._sum?.deltaRolls || 0;

    // Active reserved rolls = sum of active reservations (orderedRolls - dispatchedRolls - cancelledRolls)
    const activeOrders = await db.salesOrder.findMany({
      where: { specificationId: spec.id },
    });

    let reservedRolls = 0;
    for (const ord of activeOrders) {
      const pending = ord.orderedRolls - ord.dispatchedRolls - ord.cancelledRolls;
      if (pending > 0) reservedRolls += pending;
    }

    const availableRolls = Math.max(0, onHandRolls - reservedRolls);

    const bom1 = calculateBOM(
      {
        widthMm: spec.widthMm.toString(),
        filmGsm: spec.filmGsm.toString(),
        dryCoatingGsm: spec.dryAdhesiveGsm.toString(),
        adhesiveSolidsPercent: spec.solidsPercent.toString(),
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
