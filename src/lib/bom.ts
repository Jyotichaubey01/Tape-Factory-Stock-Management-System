import Decimal from "decimal.js";

// Configure Decimal.js precision for high-precision calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface TapeSpecInput {
  widthMm: number | string | Decimal;
  filmGsm: number | string | Decimal;
  dryCoatingGsm: number | string | Decimal;
  adhesiveSolidsPercent: number | string | Decimal;
  rollLengthM: number | string | Decimal;
}

export interface BomCalculationResult {
  rollCount: number;
  areaM2: Decimal;
  filmKg: Decimal;
  dryAdhesiveKg: Decimal;
  liquidAdhesiveKg: Decimal;
  cores: number;
  netTapeKg: Decimal;
  netTapeKgPerRoll: Decimal;
  metresPerRoll: Decimal;
  totalMetres: Decimal;
}

export interface ProductionComparisonInput {
  spec: TapeSpecInput;
  rollCount: number;
  actualFilmIssuedKg: number | string | Decimal;
  actualLiquidAdhesiveIssuedKg: number | string | Decimal;
  dryWastageKg: number | string | Decimal;
}

export interface ProductionComparisonResult {
  expectedFilmKg: Decimal;
  expectedDryAdhesiveKg: Decimal;
  expectedLiquidAdhesiveKg: Decimal;
  actualFilmIssuedKg: Decimal;
  actualLiquidAdhesiveIssuedKg: Decimal;
  actualDryAdhesiveKg: Decimal;
  dryWastageKg: Decimal;
  productionInputKg: Decimal;
  netTapeProducedKg: Decimal;
  productionOutputKg: Decimal;
  productionDifferenceKg: Decimal;
  isWithinTolerance: boolean;
  toleranceKg: Decimal;
  differenceSummary: string;
}

/**
 * Standard Production Precision Tolerance: 0.050 kg (50 grams)
 * Documented industrial tolerance for mass-balance verification.
 */
export const PRODUCTION_TOLERANCE_KG = new Decimal("0.050");

/**
 * Order Net Tape KG Tolerance: 0.005 kg (5 grams)
 * For determining if a net tape kg order corresponds exactly to a whole roll count.
 */
export const ORDER_KG_TOLERANCE = new Decimal("0.005");

/**
 * Calculate BOM requirements for a given specification and roll count.
 */
export function calculateBOM(spec: TapeSpecInput, rollCount: number): BomCalculationResult {
  if (rollCount <= 0 || !Number.isInteger(rollCount)) {
    throw new Error("Roll count must be a positive whole integer");
  }

  const widthMm = new Decimal(spec.widthMm);
  const filmGsm = new Decimal(spec.filmGsm);
  const dryCoatingGsm = new Decimal(spec.dryCoatingGsm);
  const adhesiveSolidsPercent = new Decimal(spec.adhesiveSolidsPercent);
  const rollLengthM = new Decimal(spec.rollLengthM);

  if (widthMm.lte(0)) throw new Error("Width must be greater than 0 mm");
  if (filmGsm.lte(0)) throw new Error("Film GSM must be greater than 0");
  if (dryCoatingGsm.lte(0)) throw new Error("Dry coating GSM must be greater than 0");
  if (rollLengthM.lte(0)) throw new Error("Roll length must be greater than 0 metres");
  if (adhesiveSolidsPercent.lte(0) || adhesiveSolidsPercent.gt(100)) {
    throw new Error("Adhesive solids percentage must be between > 0% and <= 100%");
  }

  const rolls = new Decimal(rollCount);

  // areaM2 = (widthMm / 1000) * rollLengthM * rollCount
  const areaM2 = widthMm.div(1000).mul(rollLengthM).mul(rolls);

  // filmKg = areaM2 * filmGSM / 1000
  const filmKg = areaM2.mul(filmGsm).div(1000);

  // dryAdhesiveKg = areaM2 * dryCoatingGSM / 1000
  const dryAdhesiveKg = areaM2.mul(dryCoatingGsm).div(1000);

  // liquidAdhesiveKg = dryAdhesiveKg / (solidsPercentage / 100)
  const solidsFraction = adhesiveSolidsPercent.div(100);
  const liquidAdhesiveKg = dryAdhesiveKg.div(solidsFraction);

  // cores = rollCount
  const cores = rollCount;

  // netTapeKg = filmKg + dryAdhesiveKg
  const netTapeKg = filmKg.plus(dryAdhesiveKg);

  const netTapeKgPerRoll = netTapeKg.div(rolls);
  const totalMetres = rollLengthM.mul(rolls);

  return {
    rollCount,
    areaM2,
    filmKg,
    dryAdhesiveKg,
    liquidAdhesiveKg,
    cores,
    netTapeKg,
    netTapeKgPerRoll,
    metresPerRoll: rollLengthM,
    totalMetres,
  };
}

/**
 * Calculate actual dry adhesive from liquid adhesive issued:
 * actualDryAdhesiveKg = liquidAdhesiveIssuedKg * solidsPercentage / 100
 */
export function calculateActualDryAdhesive(
  liquidAdhesiveIssuedKg: number | string | Decimal,
  solidsPercentage: number | string | Decimal
): Decimal {
  const liquid = new Decimal(liquidAdhesiveIssuedKg);
  const solids = new Decimal(solidsPercentage).div(100);
  return liquid.mul(solids);
}

/**
 * Verify production mass balance and compare expected vs actual quantities.
 */
export function verifyProductionBatch(input: ProductionComparisonInput): ProductionComparisonResult {
  const bom = calculateBOM(input.spec, input.rollCount);

  const actualFilmIssuedKg = new Decimal(input.actualFilmIssuedKg);
  const actualLiquidAdhesiveIssuedKg = new Decimal(input.actualLiquidAdhesiveIssuedKg);
  const dryWastageKg = new Decimal(input.dryWastageKg);

  if (actualFilmIssuedKg.lte(0)) throw new Error("Film issued must be greater than 0 kg");
  if (actualLiquidAdhesiveIssuedKg.lte(0)) throw new Error("Liquid adhesive issued must be greater than 0 kg");
  if (dryWastageKg.lt(0)) throw new Error("Dry wastage cannot be negative");

  // actualDryAdhesiveKg = liquidAdhesiveIssuedKg * solidsPercentage / 100
  const actualDryAdhesiveKg = calculateActualDryAdhesive(actualLiquidAdhesiveIssuedKg, input.spec.adhesiveSolidsPercent);

  // productionInputKg = actualFilmIssuedKg + actualDryAdhesiveKg
  const productionInputKg = actualFilmIssuedKg.plus(actualDryAdhesiveKg);

  // netTapeProducedKg = expectedFilmKg + expectedDryAdhesiveKg
  const netTapeProducedKg = bom.filmKg.plus(bom.dryAdhesiveKg);

  // productionOutputKg = netTapeProducedKg + dryWastageKg
  const productionOutputKg = netTapeProducedKg.plus(dryWastageKg);

  // productionDifferenceKg = productionInputKg - productionOutputKg
  const productionDifferenceKg = productionInputKg.minus(productionOutputKg);

  const isWithinTolerance = productionDifferenceKg.abs().lte(PRODUCTION_TOLERANCE_KG);

  let differenceSummary = "";
  if (isWithinTolerance) {
    differenceSummary = `Mass balance verified within ±${PRODUCTION_TOLERANCE_KG.toFixed(3)} kg tolerance (Difference: ${productionDifferenceKg.toFixed(4)} kg).`;
  } else {
    differenceSummary = `Mass balance mismatch! Input (${productionInputKg.toFixed(3)} kg) differs from Output (${productionOutputKg.toFixed(3)} kg) by ${productionDifferenceKg.toFixed(3)} kg, exceeding ±${PRODUCTION_TOLERANCE_KG.toFixed(3)} kg tolerance.`;
  }

  return {
    expectedFilmKg: bom.filmKg,
    expectedDryAdhesiveKg: bom.dryAdhesiveKg,
    expectedLiquidAdhesiveKg: bom.liquidAdhesiveKg,
    actualFilmIssuedKg,
    actualLiquidAdhesiveIssuedKg,
    actualDryAdhesiveKg,
    dryWastageKg,
    productionInputKg,
    netTapeProducedKg,
    productionOutputKg,
    productionDifferenceKg,
    isWithinTolerance,
    toleranceKg: PRODUCTION_TOLERANCE_KG,
    differenceSummary,
  };
}

/**
 * Validate and convert order quantity in Rolls, Metres, or Net Kg into whole roll counts.
 * Rejects invalid quantities without silently rounding and returns valid alternatives.
 */
export function parseOrderQuantity(
  unit: "ROLLS" | "METRES" | "NET_KG",
  value: number | string | Decimal,
  spec: TapeSpecInput
): {
  isValid: boolean;
  orderedRolls: number;
  error?: string;
  alternatives?: { rolls: number; metres: number; netKg: string }[];
} {
  const val = new Decimal(value);
  if (val.lte(0)) {
    return {
      isValid: false,
      orderedRolls: 0,
      error: "Order quantity must be strictly greater than 0.",
    };
  }

  const rollLengthM = new Decimal(spec.rollLengthM);
  const oneRollBom = calculateBOM(spec, 1);
  const netKgPerRoll = oneRollBom.netTapeKg;

  if (unit === "ROLLS") {
    if (!val.isInteger()) {
      const lower = val.floor().toNumber();
      const upper = val.ceil().toNumber();
      return {
        isValid: false,
        orderedRolls: 0,
        error: `Rolls must be a positive whole integer. You entered ${val.toString()}.`,
        alternatives: [
          ...(lower > 0
            ? [{ rolls: lower, metres: lower * rollLengthM.toNumber(), netKg: netKgPerRoll.mul(lower).toFixed(3) }]
            : []),
          { rolls: upper, metres: upper * rollLengthM.toNumber(), netKg: netKgPerRoll.mul(upper).toFixed(3) },
        ],
      };
    }
    return { isValid: true, orderedRolls: val.toNumber() };
  }

  if (unit === "METRES") {
    if (!val.isInteger()) {
      return {
        isValid: false,
        orderedRolls: 0,
        error: `Metres must be a positive whole number.`,
      };
    }
    const remainder = val.mod(rollLengthM);
    if (!remainder.isZero()) {
      const lowerRolls = val.div(rollLengthM).floor().toNumber();
      const upperRolls = val.div(rollLengthM).ceil().toNumber();
      return {
        isValid: false,
        orderedRolls: 0,
        error: `Metres (${val.toString()} m) must be an exact multiple of the roll length (${rollLengthM.toString()} m).`,
        alternatives: [
          ...(lowerRolls > 0
            ? [
                {
                  rolls: lowerRolls,
                  metres: lowerRolls * rollLengthM.toNumber(),
                  netKg: netKgPerRoll.mul(lowerRolls).toFixed(3),
                },
              ]
            : []),
          {
            rolls: upperRolls,
            metres: upperRolls * rollLengthM.toNumber(),
            netKg: netKgPerRoll.mul(upperRolls).toFixed(3),
          },
        ],
      };
    }
    return { isValid: true, orderedRolls: val.div(rollLengthM).toNumber() };
  }

  if (unit === "NET_KG") {
    // Check if val is an exact multiple of netKgPerRoll within ORDER_KG_TOLERANCE
    const estimatedRollsDec = val.div(netKgPerRoll);
    const roundedRolls = estimatedRollsDec.round().toNumber();
    const expectedKgForRolls = netKgPerRoll.mul(roundedRolls);
    const diff = val.minus(expectedKgForRolls).abs();

    if (roundedRolls <= 0 || diff.gt(ORDER_KG_TOLERANCE)) {
      const lowerRolls = estimatedRollsDec.floor().toNumber();
      const upperRolls = estimatedRollsDec.ceil().toNumber();
      return {
        isValid: false,
        orderedRolls: 0,
        error: `Net tape weight (${val.toString()} kg) does not correspond to an exact whole roll count for this specification (${netKgPerRoll.toFixed(3)} kg/roll).`,
        alternatives: [
          ...(lowerRolls > 0
            ? [
                {
                  rolls: lowerRolls,
                  metres: lowerRolls * rollLengthM.toNumber(),
                  netKg: netKgPerRoll.mul(lowerRolls).toFixed(3),
                },
              ]
            : []),
          {
            rolls: upperRolls,
            metres: upperRolls * rollLengthM.toNumber(),
            netKg: netKgPerRoll.mul(upperRolls).toFixed(3),
          },
        ],
      };
    }

    return { isValid: true, orderedRolls: roundedRolls };
  }

  return { isValid: false, orderedRolls: 0, error: `Invalid order unit: ${unit}` };
}

/**
 * Format weights to 3 decimal places for display purposes only.
 * (Never use display-rounded values in calculations or ledger records)
 */
export function formatWeightDisplay(val: number | string | Decimal | null | undefined): string {
  if (val === null || val === undefined) return "0.000";
  return new Decimal(val).toFixed(3);
}

/**
 * Format dimensions/metres for display.
 */
export function formatDimensionDisplay(val: number | string | Decimal | null | undefined): string {
  if (val === null || val === undefined) return "0.00";
  return new Decimal(val).toFixed(2);
}
