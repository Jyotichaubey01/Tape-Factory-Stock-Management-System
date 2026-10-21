export type UserRole = "ADMIN" | "STAFF";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type MaterialType = "FILM" | "LIQUID_ADHESIVE" | "CORE";
export type MaterialTransactionType = "RECEIPT" | "PRODUCTION_ISSUE" | "DAMAGE" | "CORRECTION";
export type MaterialUnit = "KG" | "PCS";

export type OrderUnit = "ROLLS" | "METRES" | "NET_KG";
export type OrderStatus = "CONFIRMED" | "PARTIALLY_DISPATCHED" | "FULFILLED" | "CANCELLED";

export type CorrectionTarget =
  | "MATERIAL_LEDGER"
  | "FINISHED_GOODS_LEDGER"
  | "PRODUCTION_BATCH"
  | "SALES_ORDER";

export interface MaterialBalanceSummary {
  filmKg: number;
  liquidAdhesiveKg: number;
  coresPcs: number;
}

export interface FinishedGoodsSummary {
  specificationId: string;
  specificationCode: string;
  onHandRolls: number;
  reservedRolls: number;
  availableRolls: number;
  metres: number;
  netTapeKg: number;
}
