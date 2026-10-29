import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { verifyProductionBatch, calculateBOM, PRODUCTION_TOLERANCE_KG } from "../bom";
import { getMaterialBalances } from "./stock-service";
import { Prisma } from "@prisma/client";

export interface CreateProductionBatchInput {
  batchNumber: string;
  specificationId: number | string;
  rollCount: number;
  filmIssuedKg: number;
  liquidAdhesiveIssuedKg: number;
  dryWastageKg: number;
  userId: number | string;
  userRole: string;
}

export async function createProductionBatch(input: CreateProductionBatchInput) {
  const specId = typeof input.specificationId === "number" ? input.specificationId : parseInt(String(input.specificationId), 10);
  const numericUserId = typeof input.userId === "number" ? input.userId : parseInt(String(input.userId), 10) || 1;

  // 1. Fetch Specification
  const spec = await prisma.tapeSpecification.findUnique({
    where: { id: specId },
  });

  if (!spec) {
    throw new Error(`Tape specification with ID "${input.specificationId}" not found.`);
  }

  // 2. Validate BOM & Mass Balance
  const verification = verifyProductionBatch({
    spec: {
      widthMm: spec.widthMm.toString(),
      filmGsm: spec.filmGsm.toString(),
      dryCoatingGsm: spec.dryAdhesiveGsm.toString(),
      adhesiveSolidsPercent: spec.solidsPercent.toString(),
      rollLengthM: spec.rollLengthM.toString(),
    },
    rollCount: input.rollCount,
    actualFilmIssuedKg: input.filmIssuedKg,
    actualLiquidAdhesiveIssuedKg: input.liquidAdhesiveIssuedKg,
    dryWastageKg: input.dryWastageKg,
  });

  if (!verification.isWithinTolerance) {
    throw new Error(
      `Production batch rejected due to mass-balance mismatch: ${verification.differenceSummary}`
    );
  }

  // 3. Check for Duplicate Batch Number
  const existingBatch = await prisma.productionBatch.findUnique({
    where: { batchNumber: input.batchNumber },
  });

  if (existingBatch) {
    throw new Error(`Batch number "${input.batchNumber}" already exists. Batch numbers must be globally unique.`);
  }

  // 4. Atomic Transaction: Check raw materials -> Deduct materials -> Create Batch -> Add Finished Goods
  return await prisma.$transaction(async (tx) => {
    // Check Raw Material Balances inside transaction
    const balances = await getMaterialBalances(tx);

    const requiredFilm = new Decimal(input.filmIssuedKg);
    const requiredAdhesive = new Decimal(input.liquidAdhesiveIssuedKg);
    const requiredCores = input.rollCount;

    const availableFilm = new Decimal(balances.filmKg);
    const availableAdhesive = new Decimal(balances.liquidAdhesiveKg);
    const availableCores = balances.coresPcs;

    const shortages: string[] = [];

    if (availableFilm.lt(requiredFilm)) {
      const shortage = requiredFilm.minus(availableFilm);
      shortages.push(
        `Film shortage: need ${requiredFilm.toFixed(3)} kg, available ${availableFilm.toFixed(3)} kg (short by ${shortage.toFixed(3)} kg)`
      );
    }

    if (availableAdhesive.lt(requiredAdhesive)) {
      const shortage = requiredAdhesive.minus(availableAdhesive);
      shortages.push(
        `Liquid Adhesive shortage: need ${requiredAdhesive.toFixed(3)} kg, available ${availableAdhesive.toFixed(3)} kg (short by ${shortage.toFixed(3)} kg)`
      );
    }

    if (availableCores < requiredCores) {
      const shortage = requiredCores - availableCores;
      shortages.push(
        `Core shortage: need ${requiredCores} pcs, available ${availableCores} pcs (short by ${shortage} pcs)`
      );
    }

    if (shortages.length > 0) {
      throw new Error(`Production failed due to insufficient raw materials:\n${shortages.join("\n")}`);
    }

    // Create Production Batch record
    const batch = await tx.productionBatch.create({
      data: {
        batchNumber: input.batchNumber,
        specificationId: specId,
        rolls: input.rollCount,
        filmIssuedKg: verification.actualFilmIssuedKg.toNumber(),
        adhesiveIssuedKg: verification.actualLiquidAdhesiveIssuedKg.toNumber(),
        dryWastageKg: verification.dryWastageKg.toNumber(),
        expectedFilmKg: verification.expectedFilmKg.toNumber(),
        expectedAdhesiveKg: verification.expectedLiquidAdhesiveKg.toNumber(),
        actualDryAdhesiveKg: verification.actualDryAdhesiveKg.toNumber(),
        productionDifferenceKg: verification.productionDifferenceKg.toNumber(),
        userId: numericUserId,
      },
    });

    // Material Deductions (append-only ledger with negative quantities)
    await tx.materialLedger.create({
      data: {
        material: "FILM",
        type: "PRODUCTION_ISSUE",
        quantity: requiredFilm.negated().toNumber(),
        reference: input.batchNumber,
        reason: `Production issue for Batch ${input.batchNumber}`,
        userId: numericUserId,
        batchId: batch.id,
      },
    });

    await tx.materialLedger.create({
      data: {
        material: "ADHESIVE",
        type: "PRODUCTION_ISSUE",
        quantity: requiredAdhesive.negated().toNumber(),
        reference: input.batchNumber,
        reason: `Production issue for Batch ${input.batchNumber}`,
        userId: numericUserId,
        batchId: batch.id,
      },
    });

    await tx.materialLedger.create({
      data: {
        material: "CORES",
        type: "PRODUCTION_ISSUE",
        quantity: -requiredCores,
        reference: input.batchNumber,
        reason: `Production core issue for Batch ${input.batchNumber}`,
        userId: numericUserId,
        batchId: batch.id,
      },
    });

    // Add Finished Goods to ledger
    await tx.finishedGoodsLedger.create({
      data: {
        specificationId: specId,
        deltaRolls: input.rollCount,
        type: "PRODUCTION",
        reference: batch.batchNumber,
        reason: `Batch ${batch.batchNumber} completion`,
        userId: numericUserId,
        batchId: batch.id,
      },
    });

    return batch;
  });
}
