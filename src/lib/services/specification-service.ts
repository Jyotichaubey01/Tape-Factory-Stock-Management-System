import { prisma } from "../prisma";
import Decimal from "decimal.js";
import { tapeSpecificationSchema } from "../validations";

export interface CreateSpecificationInput {
  code: string;
  widthMm: number;
  filmGsm: number;
  dryCoatingGsm: number;
  adhesiveSolidsPercent: number;
  rollLengthM: number;
  createdById: string;
}

export async function createSpecification(input: CreateSpecificationInput) {
  // Validate schema
  const parsed = tapeSpecificationSchema.parse(input);

  const existing = await prisma.tapeSpecification.findUnique({
    where: { code: parsed.code },
  });

  if (existing) {
    throw new Error(`Tape specification with code "${parsed.code}" already exists.`);
  }

  return prisma.tapeSpecification.create({
    data: {
      code: parsed.code,
      version: 1,
      widthMm: parsed.widthMm,
      filmGsm: parsed.filmGsm,
      dryCoatingGsm: parsed.dryCoatingGsm,
      adhesiveSolidsPercent: parsed.adhesiveSolidsPercent,
      rollLengthM: parsed.rollLengthM,
      isUsedForProduction: false,
      createdById: input.createdById,
    },
  });
}

/**
 * Creates a new version of an existing specification.
 * Preserves the original specification and all linked batches/orders.
 */
export async function createSpecificationVersion(
  originalId: string,
  updatedFields: Partial<CreateSpecificationInput>,
  userId: string
) {
  const original = await prisma.tapeSpecification.findUnique({
    where: { id: originalId },
  });

  if (!original) {
    throw new Error(`Original specification "${originalId}" not found.`);
  }

  const nextVersion = original.version + 1;
  const newCode = `${original.code}-v${nextVersion}`;

  const widthMm = updatedFields.widthMm ?? original.widthMm.toNumber();
  const filmGsm = updatedFields.filmGsm ?? original.filmGsm.toNumber();
  const dryCoatingGsm = updatedFields.dryCoatingGsm ?? original.dryCoatingGsm.toNumber();
  const adhesiveSolidsPercent =
    updatedFields.adhesiveSolidsPercent ?? original.adhesiveSolidsPercent.toNumber();
  const rollLengthM = updatedFields.rollLengthM ?? original.rollLengthM.toNumber();

  tapeSpecificationSchema.parse({
    code: newCode,
    widthMm,
    filmGsm,
    dryCoatingGsm,
    adhesiveSolidsPercent,
    rollLengthM,
  });

  return prisma.tapeSpecification.create({
    data: {
      code: newCode,
      version: nextVersion,
      widthMm,
      filmGsm,
      dryCoatingGsm,
      adhesiveSolidsPercent,
      rollLengthM,
      isUsedForProduction: false,
      createdById: userId,
    },
  });
}
