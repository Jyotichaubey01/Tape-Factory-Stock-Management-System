import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { getMaterialBalances, getFinishedGoodsBalances } from "./stock-service";
import { calculateBOM } from "../bom";

export interface AdminStockAdjustmentInput {
  targetType: "MATERIAL_LEDGER" | "FINISHED_GOODS_LEDGER";
  materialType?: "FILM" | "LIQUID_ADHESIVE" | "CORE";
  specificationId?: string;
  adjustmentQuantity: number; // positive to add stock, negative to subtract
  reason: string;
  adminId: string;
  adminRole: string;
}

export async function performAdminStockCorrection(input: AdminStockAdjustmentInput) {
  // Permission guard: strictly ADMIN
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

  return await prisma.$transaction(async (tx) => {
    // 1. Raw Material Correction
    if (input.targetType === "MATERIAL_LEDGER") {
      if (!input.materialType) {
        throw new Error("Material type is required for material ledger corrections.");
      }

      const balances = await getMaterialBalances(tx);
      const adj = new Decimal(input.adjustmentQuantity);

      let currentBal = new Decimal(0);
      let unit = "KG";
      if (input.materialType === "FILM") currentBal = new Decimal(balances.filmKg);
      if (input.materialType === "LIQUID_ADHESIVE") currentBal = new Decimal(balances.liquidAdhesiveKg);
      if (input.materialType === "CORE") {
        currentBal = new Decimal(balances.coresPcs);
        unit = "PCS";
      }

      const projectedBal = currentBal.plus(adj);
      if (projectedBal.lt(0)) {
        throw new Error(
          `Correction rejected: would result in negative stock balance for ${input.materialType}. Current: ${currentBal.toFixed(3)} ${unit}, Adjustment: ${adj.toFixed(3)} ${unit}, Projected: ${projectedBal.toFixed(3)} ${unit}.`
        );
      }

      // Record linked correction record
      const correctionRecord = await tx.correctionRecord.create({
        data: {
          targetType: "MATERIAL_LEDGER",
          targetId: `RAW-${input.materialType}-${Date.now()}`,
          reason: input.reason,
          priorDataJson: JSON.stringify({
            materialType: input.materialType,
            previousBalance: currentBal.toNumber(),
          }),
          correctionDataJson: JSON.stringify({
            adjustmentQuantity: adj.toNumber(),
            projectedBalance: projectedBal.toNumber(),
            unit,
          }),
          adminId: input.adminId,
        },
      });

      // Insert offsetting entry in MaterialLedger
      await tx.materialLedger.create({
        data: {
          materialType: input.materialType,
          transactionType: "CORRECTION",
          quantity: adj.toNumber(),
          unit: input.materialType === "CORE" ? "PCS" : "KG",
          referenceType: "CORRECTION",
          referenceId: correctionRecord.id,
          notes: `Admin correction: ${input.reason}`,
          userId: input.adminId,
        },
      });

      return correctionRecord;
    }

    // 2. Finished Goods Stock Correction
    if (input.targetType === "FINISHED_GOODS_LEDGER") {
      if (!input.specificationId) {
        throw new Error("Specification ID is required for finished goods corrections.");
      }

      const spec = await tx.tapeSpecification.findUnique({
        where: { id: input.specificationId },
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

      const bom = calculateBOM(
        {
          widthMm: spec.widthMm.toString(),
          filmGsm: spec.filmGsm.toString(),
          dryCoatingGsm: spec.dryCoatingGsm.toString(),
          adhesiveSolidsPercent: spec.adhesiveSolidsPercent.toString(),
          rollLengthM: spec.rollLengthM.toString(),
        },
        Math.abs(adjRolls) > 0 ? Math.abs(adjRolls) : 1
      );

      const netKg = adjRolls >= 0 ? bom.netTapeKg.toNumber() : -bom.netTapeKg.toNumber();
      const metres = adjRolls >= 0 ? bom.totalMetres.toNumber() : -bom.totalMetres.toNumber();

      // Record linked correction record
      const correctionRecord = await tx.correctionRecord.create({
        data: {
          targetType: "FINISHED_GOODS_LEDGER",
          targetId: `FG-${spec.code}-${Date.now()}`,
          reason: input.reason,
          priorDataJson: JSON.stringify({
            specificationCode: spec.code,
            previousOnHandRolls: onHandRolls,
            activeReservedRolls: reservedRolls,
          }),
          correctionDataJson: JSON.stringify({
            adjustmentRolls: adjRolls,
            projectedOnHandRolls: projectedOnHand,
            netKg,
            metres,
          }),
          adminId: input.adminId,
        },
      });

      // Insert offsetting entry in FinishedGoodsLedger
      await tx.finishedGoodsLedger.create({
        data: {
          specificationId: spec.id,
          transactionType: "CORRECTION",
          rollCount: adjRolls,
          netTapeKg: netKg,
          metres: metres,
          referenceType: "CORRECTION",
          referenceId: correctionRecord.id,
          notes: `Admin correction: ${input.reason}`,
          userId: input.adminId,
        },
      });

      return correctionRecord;
    }

    throw new Error(`Unsupported correction target type: ${input.targetType}`);
  });
}
