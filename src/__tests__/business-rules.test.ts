import { describe, it, expect } from "vitest";
import { performAdminStockCorrection } from "../lib/services/correction-service";
import { checkIdempotency } from "../lib/idempotency";
import Decimal from "decimal.js";

describe("Business Invariants & Security Rules", () => {
  describe("Role-Based Access Control (RBAC) & Admin Corrections (Section 4 & 10)", () => {
    it("strictly blocks Staff from performing Admin corrections (HTTP 403)", async () => {
      await expect(
        performAdminStockCorrection({
          targetType: "MATERIAL_LEDGER",
          materialType: "FILM",
          adjustmentQuantity: 50,
          reason: "Staff attempting to adjust stock balance directly",
          adminId: "staff-user-id",
          adminRole: "STAFF", // Staff role
        })
      ).rejects.toThrow(/FORBIDDEN: Only System Administrators can perform stock corrections/);
    });

    it("requires a mandatory reason of at least 10 characters for corrections", async () => {
      await expect(
        performAdminStockCorrection({
          targetType: "MATERIAL_LEDGER",
          materialType: "FILM",
          adjustmentQuantity: 50,
          reason: "Too short", // < 10 chars
          adminId: "admin-user-id",
          adminRole: "ADMIN",
        })
      ).rejects.toThrow(/Audit compliance requires a detailed reason of at least 10 characters/);
    });

    it("rejects zero quantity adjustments", async () => {
      await expect(
        performAdminStockCorrection({
          targetType: "MATERIAL_LEDGER",
          materialType: "FILM",
          adjustmentQuantity: 0,
          reason: "Adjustment with no change whatsoever",
          adminId: "admin-user-id",
          adminRole: "ADMIN",
        })
      ).rejects.toThrow(/Adjustment quantity cannot be zero/);
    });
  });

  describe("Idempotency & Duplicate Prevention (Section 12)", () => {
    it("handles missing idempotency key cleanly without errors", async () => {
      const result = await checkIdempotency("", "/api/orders", {});
      expect(result).toBeNull();
    });
  });

  describe("Decimal Precision & Ledger Integrity (Section 5 & 6)", () => {
    it("preserves high-precision calculations without binary floating-point drift", () => {
      // 0.1 + 0.2 in standard JS IEEE 754 is 0.30000000000000004
      const d1 = new Decimal("0.1");
      const d2 = new Decimal("0.2");
      expect(d1.plus(d2).toString()).toBe("0.3");

      // 1000 rolls of 2.256 kg
      const rollKg = new Decimal("2.256");
      const thousandRolls = rollKg.mul(1000);
      expect(thousandRolls.toFixed(3)).toBe("2256.000");
    });
  });
});
