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
  createdById?: string | number;
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
      widthMm: parsed.widthMm,
      filmGsm: parsed.filmGsm,
      dryAdhesiveGsm: parsed.dryCoatingGsm,
      solidsPercent: parsed.adhesiveSolidsPercent,
      rollLengthM: parsed.rollLengthM,
    },
  });
}

/**
 * Creates a new version of an existing specification.
 */
export async function createSpecificationVersion(
  originalId: string | number,
  updatedFields: Partial<CreateSpecificationInput>,
  userId?: string | number
) {
  const specId = typeof originalId === "number" ? originalId : parseInt(String(originalId), 10);

  const original = await prisma.tapeSpecification.findUnique({
    where: { id: specId },
  });

  if (!original) {
    throw new Error(`Original specification "${originalId}" not found.`);
  }

  const newCode = `${original.code}-v${Date.now().toString().slice(-4)}`;

  const widthMm = updatedFields.widthMm ?? original.widthMm.toNumber();
  const filmGsm = updatedFields.filmGsm ?? original.filmGsm.toNumber();
  const dryCoatingGsm = updatedFields.dryCoatingGsm ?? original.dryAdhesiveGsm.toNumber();
  const adhesiveSolidsPercent =
    updatedFields.adhesiveSolidsPercent ?? original.solidsPercent.toNumber();
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
      widthMm,
      filmGsm,
      dryAdhesiveGsm: dryCoatingGsm,
      solidsPercent: adhesiveSolidsPercent,
      rollLengthM,
    },
  });
}
