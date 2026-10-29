import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { getMaterialBalances, getFinishedGoodsBalances } from "./stock-service";
import { calculateBOM } from "../bom";
import { material_ledger_material, correction_records_material } from "@prisma/client";

export interface AdminStockAdjustmentInput {
  targetType: "MATERIAL_LEDGER" | "FINISHED_GOODS_LEDGER";
  materialType?: "FILM" | "ADHESIVE" | "CORES";
  specificationId?: number | string;
  adjustmentQuantity: number;
  reason: string;
  adminId: number | string;
  adminRole: string;
}

export async function performAdminStockCorrection(input: AdminStockAdjustmentInput) {
  if (input.adminRole !== "ADMIN") {
    const err = new Error("FORBIDDEN: Only System Administrators can perform stock corrections.");
    (err as any).statusCode = 403;
    throw err;
  }

  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error("Audit compliance requires a detailed reason of at least 10 characters for any correction.");
  }

  if (input.adjustmentQuantity === 0) {
    throw new Error("Adjustment quantity cannot be zero.");
  }

  const numericAdminId =
    typeof input.adminId === "number" ? input.adminId : parseInt(String(input.adminId), 10) || 1;

  return await prisma.$transaction(async (tx) => {
    // 1. Raw Material Correction
    if (input.targetType === "MATERIAL_LEDGER") {
      if (!input.materialType) {
        throw new Error("Material type is required for material ledger corrections.");
      }

      const balances = await getMaterialBalances(tx);
      const adj = new Decimal(input.adjustmentQuantity);

      let currentBal = new Decimal(0);
      const unit = input.materialType === "CORES" ? "PCS" : "KG";
      if (input.materialType === "FILM") currentBal = new Decimal(balances.filmKg);
      if (input.materialType === "ADHESIVE") currentBal = new Decimal(balances.liquidAdhesiveKg);
      if (input.materialType === "CORES") currentBal = new Decimal(balances.coresPcs);

      const projectedBal = currentBal.plus(adj);
      if (projectedBal.lt(0)) {
        throw new Error(
          `Correction rejected: would result in negative stock balance for ${input.materialType}. Current: ${currentBal.toFixed(3)} ${unit}, Adjustment: ${adj.toFixed(3)} ${unit}, Projected: ${projectedBal.toFixed(3)} ${unit}.`
        );
      }

      const corrRef = `CORR-${Date.now()}`;

      // Insert offsetting entry in MaterialLedger
      const newLedgerEntry = await tx.materialLedger.create({
        data: {
          material: input.materialType as material_ledger_material,
          type: "CORRECTION",
          quantity: adj.toNumber(),
          reference: corrRef,
          reason: `Admin correction: ${input.reason}`,
          userId: numericAdminId,
        },
      });

      // Find original ledger id or fallback to this new entry
      const lastEntry = await tx.materialLedger.findFirst({
        where: { material: input.materialType as material_ledger_material },
        orderBy: { id: "desc" },
      });

      // Record linked correction record
      const correctionRecord = await tx.correctionRecord.create({
        data: {
          material: input.materialType as correction_records_material,
          adjustment: adj.toNumber(),
          reason: input.reason,
          reference: corrRef,
          originalLedgerId: lastEntry ? lastEntry.id : newLedgerEntry.id,
          materialLedgerId: newLedgerEntry.id,
          userId: numericAdminId,
        },
      });

      return correctionRecord;
    }

    // 2. Finished Goods Stock Correction
    if (input.targetType === "FINISHED_GOODS_LEDGER") {
      if (!input.specificationId) {
        throw new Error("Specification ID is required for finished goods corrections.");
      }

      const specId =
        typeof input.specificationId === "number"
          ? input.specificationId
          : parseInt(String(input.specificationId), 10);

      const spec = await tx.tapeSpecification.findUnique({
        where: { id: specId },
      });

      if (!spec) {
        throw new Error(`Specification "${input.specificationId}" not found.`);
      }

      const summaries = await getFinishedGoodsBalances(tx);
      const currentStock = summaries.find((s) => s.specificationId === spec.id);
      const onHandRolls = currentStock ? currentStock.onHandRolls : 0;
      const reservedRolls = currentStock ? currentStock.reservedRolls : 0;

      const adjRolls = Math.trunc(input.adjustmentQuantity);
      const projectedOnHand = onHandRolls + adjRolls;

      if (projectedOnHand < 0) {
        throw new Error(
          `Correction rejected: would result in negative physical finished rolls. On-Hand: ${onHandRolls}, Adjustment: ${adjRolls}, Projected: ${projectedOnHand}.`
        );
      }

      // Check reservation conflict
      if (projectedOnHand < reservedRolls) {
        const conflict = reservedRolls - projectedOnHand;
        throw new Error(
          `Correction rejected: projected on-hand stock (${projectedOnHand} rolls) would violate active customer reservations (${reservedRolls} rolls). Conflict shortage: ${conflict} rolls.`
        );
      }

      // Insert offsetting entry in FinishedGoodsLedger
      const newFgEntry = await tx.finishedGoodsLedger.create({
        data: {
          specificationId: spec.id,
          deltaRolls: adjRolls,
          type: "CORRECTION",
          reference: `CORR-FG-${Date.now()}`,
          reason: `Admin correction: ${input.reason}`,
          userId: numericAdminId,
        },
      });

      return newFgEntry;
    }

    throw new Error(`Unsupported correction target type: ${input.targetType}`);
  });
}
