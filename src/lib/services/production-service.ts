import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { verifyProductionBatch, calculateBOM, PRODUCTION_TOLERANCE_KG } from "../bom";
import { getMaterialBalances } from "./stock-service";
import { logAuditEvent } from "../audit";
import { Prisma } from "@prisma/client";

export interface CreateProductionBatchInput {
  batchNumber: string;
  specificationId: string;
  rollCount: number;
  filmIssuedKg: number;
  liquidAdhesiveIssuedKg: number;
  dryWastageKg: number;
  userId: string;
  userRole: string;
}

export async function createProductionBatch(input: CreateProductionBatchInput) {
  // 1. Fetch Specification
  const spec = await prisma.tapeSpecification.findUnique({
    where: { id: input.specificationId },
  });

  if (!spec) {
    throw new Error(`Tape specification with ID "${input.specificationId}" not found.`);
  }

  // 2. Validate BOM & Mass Balance
  const verification = verifyProductionBatch({
    spec: {
      widthMm: spec.widthMm.toString(),
      filmGsm: spec.filmGsm.toString(),
      dryCoatingGsm: spec.dryCoatingGsm.toString(),
      adhesiveSolidsPercent: spec.adhesiveSolidsPercent.toString(),
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

  const bom = calculateBOM(
    {
      widthMm: spec.widthMm.toString(),
      filmGsm: spec.filmGsm.toString(),
      dryCoatingGsm: spec.dryCoatingGsm.toString(),
      adhesiveSolidsPercent: spec.adhesiveSolidsPercent.toString(),
      rollLengthM: spec.rollLengthM.toString(),
    },
    input.rollCount
  );

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

    // Material Deductions (append-only ledger with negative quantities)
    await tx.materialLedger.create({
      data: {
        materialType: "FILM",
        transactionType: "PRODUCTION_ISSUE",
        quantity: requiredFilm.negated().toNumber(),
        unit: "KG",
        referenceType: "BATCH",
        referenceId: input.batchNumber,
        notes: `Production issue for Batch ${input.batchNumber}`,
        userId: input.userId,
      },
    });

    await tx.materialLedger.create({
      data: {
        materialType: "LIQUID_ADHESIVE",
        transactionType: "PRODUCTION_ISSUE",
        quantity: requiredAdhesive.negated().toNumber(),
        unit: "KG",
        referenceType: "BATCH",
        referenceId: input.batchNumber,
        notes: `Production issue for Batch ${input.batchNumber}`,
        userId: input.userId,
      },
    });

    await tx.materialLedger.create({
      data: {
        materialType: "CORE",
        transactionType: "PRODUCTION_ISSUE",
        quantity: -requiredCores,
        unit: "PCS",
        referenceType: "BATCH",
        referenceId: input.batchNumber,
        notes: `Production core issue for Batch ${input.batchNumber}`,
        userId: input.userId,
      },
    });

    // Create Production Batch record
    const batch = await tx.productionBatch.create({
      data: {
        batchNumber: input.batchNumber,
        specificationId: input.specificationId,
        rollCount: input.rollCount,
        filmIssuedKg: verification.actualFilmIssuedKg.toNumber(),
        liquidAdhesiveIssuedKg: verification.actualLiquidAdhesiveIssuedKg.toNumber(),
        dryWastageKg: verification.dryWastageKg.toNumber(),
        coresIssued: input.rollCount,
        expectedFilmKg: verification.expectedFilmKg.toNumber(),
        expectedDryAdhesiveKg: verification.expectedDryAdhesiveKg.toNumber(),
        expectedLiquidAdhesiveKg: verification.expectedLiquidAdhesiveKg.toNumber(),
        actualDryAdhesiveKg: verification.actualDryAdhesiveKg.toNumber(),
        productionInputKg: verification.productionInputKg.toNumber(),
        netTapeProducedKg: verification.netTapeProducedKg.toNumber(),
        productionOutputKg: verification.productionOutputKg.toNumber(),
        productionDifferenceKg: verification.productionDifferenceKg.toNumber(),
        status: "COMPLETED",
        createdById: input.userId,
      },
    });

    // Mark specification immutable (used in production)
    if (!spec.isUsedForProduction) {
      await tx.tapeSpecification.update({
        where: { id: spec.id },
        data: { isUsedForProduction: true },
      });
    }

    // Add Finished Goods to ledger
    await tx.finishedGoodsLedger.create({
      data: {
        specificationId: input.specificationId,
        transactionType: "PRODUCTION_RECEIPT",
        rollCount: input.rollCount,
        netTapeKg: bom.netTapeKg.toNumber(),
        metres: bom.totalMetres.toNumber(),
        referenceType: "PRODUCTION_BATCH",
        referenceId: batch.batchNumber,
        notes: `Batch ${batch.batchNumber} completion`,
        userId: input.userId,
      },
    });

    return batch;
  });
}
