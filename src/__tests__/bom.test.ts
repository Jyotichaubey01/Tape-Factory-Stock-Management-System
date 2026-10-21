import { describe, it, expect } from "vitest";
import {
  calculateBOM,
  verifyProductionBatch,
  parseOrderQuantity,
  PRODUCTION_TOLERANCE_KG,
} from "../lib/bom";
import Decimal from "decimal.js";

describe("Tape Specification & BOM Calculations (Section 5)", () => {
  // Dummy spec: Width: 48 mm, Film GSM: 25, Dry coating GSM: 22, Adhesive solids: 50%, Roll length: 1,000 metres
  const standardSpec = {
    widthMm: 48,
    filmGsm: 25,
    dryCoatingGsm: 22,
    adhesiveSolidsPercent: 50,
    rollLengthM: 1000,
  };

  it("calculates exact dummy specification requirements for 1 roll", () => {
    const result = calculateBOM(standardSpec, 1);

    // areaM2 = (48 / 1000) * 1000 * 1 = 48 m2
    expect(result.areaM2.toNumber()).toBe(48);

    // filmKg = 48 * 25 / 1000 = 1.200 kg
    expect(result.filmKg.toFixed(3)).toBe("1.200");

    // dryAdhesiveKg = 48 * 22 / 1000 = 1.056 kg
    expect(result.dryAdhesiveKg.toFixed(3)).toBe("1.056");

    // liquidAdhesiveKg = 1.056 / (50/100) = 2.112 kg
    expect(result.liquidAdhesiveKg.toFixed(3)).toBe("2.112");

    // cores = 1
    expect(result.cores).toBe(1);

    // netTapeKg = 1.200 + 1.056 = 2.256 kg
    expect(result.netTapeKg.toFixed(3)).toBe("2.256");
  });

  it("scales BOM correctly for multiple whole rolls (e.g., 50 rolls)", () => {
    const result = calculateBOM(standardSpec, 50);

    expect(result.filmKg.toFixed(3)).toBe("60.000"); // 1.200 * 50
    expect(result.dryAdhesiveKg.toFixed(3)).toBe("52.800"); // 1.056 * 50
    expect(result.liquidAdhesiveKg.toFixed(3)).toBe("105.600"); // 2.112 * 50
    expect(result.cores).toBe(50);
    expect(result.netTapeKg.toFixed(3)).toBe("112.800"); // 2.256 * 50
  });

  it("calculates different tape specifications accurately", () => {
    const heavyDutySpec = {
      widthMm: 72,
      filmGsm: 30,
      dryCoatingGsm: 28,
      adhesiveSolidsPercent: 55,
      rollLengthM: 500,
    };

    const result = calculateBOM(heavyDutySpec, 10);
    // areaM2 = (72 / 1000) * 500 * 10 = 360 m2
    expect(result.areaM2.toNumber()).toBe(360);
    // filmKg = 360 * 30 / 1000 = 10.8 kg
    expect(result.filmKg.toFixed(3)).toBe("10.800");
    // dryAdhesiveKg = 360 * 28 / 1000 = 10.08 kg
    expect(result.dryAdhesiveKg.toFixed(3)).toBe("10.080");
    // liquidAdhesiveKg = 10.08 / 0.55 = 18.32727... kg
    expect(result.liquidAdhesiveKg.toFixed(3)).toBe("18.327");
  });

  it("rejects invalid dimensions, GSM values, and negative/zero roll counts", () => {
    expect(() => calculateBOM({ ...standardSpec, widthMm: 0 }, 1)).toThrow(/Width must be greater than 0/);
    expect(() => calculateBOM({ ...standardSpec, filmGsm: -5 }, 1)).toThrow(/Film GSM must be greater than 0/);
    expect(() => calculateBOM({ ...standardSpec, dryCoatingGsm: 0 }, 1)).toThrow(/Dry coating GSM must be greater than 0/);
    expect(() => calculateBOM({ ...standardSpec, rollLengthM: -100 }, 1)).toThrow(/Roll length must be greater than 0/);
    expect(() => calculateBOM(standardSpec, 0)).toThrow(/Roll count must be a positive whole integer/);
    expect(() => calculateBOM(standardSpec, -3)).toThrow(/Roll count must be a positive whole integer/);
    expect(() => calculateBOM(standardSpec, 2.5)).toThrow(/Roll count must be a positive whole integer/);
  });

  it("enforces adhesive solids percentage limits (>0% and <=100%)", () => {
    expect(() => calculateBOM({ ...standardSpec, adhesiveSolidsPercent: 0 }, 1)).toThrow(/between > 0% and <= 100%/);
    expect(() => calculateBOM({ ...standardSpec, adhesiveSolidsPercent: -10 }, 1)).toThrow(/between > 0% and <= 100%/);
    expect(() => calculateBOM({ ...standardSpec, adhesiveSolidsPercent: 100.1 }, 1)).toThrow(/between > 0% and <= 100%/);
    // 100% solids is allowed
    expect(() => calculateBOM({ ...standardSpec, adhesiveSolidsPercent: 100 }, 1)).not.toThrow();
  });
});

describe("Production Mass-Balance & Tolerance Verification (Section 7)", () => {
  const standardSpec = {
    widthMm: 48,
    filmGsm: 25,
    dryCoatingGsm: 22,
    adhesiveSolidsPercent: 50,
    rollLengthM: 1000,
  };

  it("accepts production batch when mass balance matches within tolerance", () => {
    // 10 rolls: Expected film = 12.000 kg, expected liquid = 21.120 kg (yields 10.560 kg dry)
    // Production Input = 12.000 + 10.560 = 22.560 kg
    // Wastage = 0.500 kg
    // Output = 22.560 (net tape) + 0.500 (wastage) = 23.060 kg
    // Difference = 0 kg if film issued = 12.500 kg or liquid issued has extra
    const result = verifyProductionBatch({
      spec: standardSpec,
      rollCount: 10,
      actualFilmIssuedKg: 12.500, // 0.500 kg extra film that ended up as wastage
      actualLiquidAdhesiveIssuedKg: 21.120, // 10.560 dry
      dryWastageKg: 0.500,
    });

    expect(result.isWithinTolerance).toBe(true);
    expect(result.productionDifferenceKg.abs().lte(PRODUCTION_TOLERANCE_KG)).toBe(true);
  });

  it("rejects production batch when production difference exceeds tolerance", () => {
    // Expected net tape = 22.560 kg.
    // Inputs: Film = 12.000 kg, Liquid = 21.120 kg -> Dry = 10.560 kg -> Input = 22.560 kg
    // But operator declares 2.000 kg dry wastage!
    // Output = 22.560 + 2.000 = 24.560 kg. Difference = -2.000 kg (violates tolerance of 0.050 kg)
    const result = verifyProductionBatch({
      spec: standardSpec,
      rollCount: 10,
      actualFilmIssuedKg: 12.000,
      actualLiquidAdhesiveIssuedKg: 21.120,
      dryWastageKg: 2.000, // Massive undeclared mass mismatch
    });

    expect(result.isWithinTolerance).toBe(false);
    expect(result.differenceSummary).toContain("Mass balance mismatch");
  });

  it("verifies wastage is extra material consumed and does not change net tape per roll", () => {
    const resultZeroWastage = verifyProductionBatch({
      spec: standardSpec,
      rollCount: 5,
      actualFilmIssuedKg: 6.000,
      actualLiquidAdhesiveIssuedKg: 10.560,
      dryWastageKg: 0,
    });

    const resultWithWastage = verifyProductionBatch({
      spec: standardSpec,
      rollCount: 5,
      actualFilmIssuedKg: 6.200,
      actualLiquidAdhesiveIssuedKg: 10.560,
      dryWastageKg: 0.200,
    });

    // Net tape produced remains exactly the same 11.280 kg (5 * 2.256)
    expect(resultZeroWastage.netTapeProducedKg.toFixed(3)).toBe("11.280");
    expect(resultWithWastage.netTapeProducedKg.toFixed(3)).toBe("11.280");
  });
});

describe("Order Unit Conversions & Validation (Section 9)", () => {
  const standardSpec = {
    widthMm: 48,
    filmGsm: 25,
    dryCoatingGsm: 22,
    adhesiveSolidsPercent: 50,
    rollLengthM: 1000,
  };

  it("validates orders in Rolls correctly", () => {
    const valid = parseOrderQuantity("ROLLS", 10, standardSpec);
    expect(valid.isValid).toBe(true);
    expect(valid.orderedRolls).toBe(10);

    const fractional = parseOrderQuantity("ROLLS", 10.5, standardSpec);
    expect(fractional.isValid).toBe(false);
    expect(fractional.error).toContain("must be a positive whole integer");
    expect(fractional.alternatives).toHaveLength(2);
    expect(fractional.alternatives?.[0].rolls).toBe(10);
    expect(fractional.alternatives?.[1].rolls).toBe(11);
  });

  it("validates orders in Metres requiring exact multiples of roll length", () => {
    // Standard spec roll length = 1000 m
    const exact = parseOrderQuantity("METRES", 5000, standardSpec);
    expect(exact.isValid).toBe(true);
    expect(exact.orderedRolls).toBe(5);

    const nonMultiple = parseOrderQuantity("METRES", 3500, standardSpec);
    expect(nonMultiple.isValid).toBe(false);
    expect(nonMultiple.error).toContain("must be an exact multiple of the roll length");
    expect(nonMultiple.alternatives).toHaveLength(2);
    expect(nonMultiple.alternatives?.[0].rolls).toBe(3);
    expect(nonMultiple.alternatives?.[0].metres).toBe(3000);
    expect(nonMultiple.alternatives?.[1].rolls).toBe(4);
    expect(nonMultiple.alternatives?.[1].metres).toBe(4000);
  });

  it("validates orders in Net Tape KG requiring exact whole rolls according to spec", () => {
    // Standard spec: 1 roll = 2.256 kg
    // 10 rolls = 22.560 kg
    const exact = parseOrderQuantity("NET_KG", 22.56, standardSpec);
    expect(exact.isValid).toBe(true);
    expect(exact.orderedRolls).toBe(10);

    // Mismatched weight (e.g. 25.000 kg does not match any integer roll count)
    const mismatched = parseOrderQuantity("NET_KG", 25.0, standardSpec);
    expect(mismatched.isValid).toBe(false);
    expect(mismatched.error).toContain("does not correspond to an exact whole roll count");
    expect(mismatched.alternatives).toHaveLength(2);
    // Closest alternatives: 11 rolls (24.816 kg) and 12 rolls (27.072 kg)
    expect(mismatched.alternatives?.[0].rolls).toBe(11);
    expect(mismatched.alternatives?.[1].rolls).toBe(12);
  });
});
