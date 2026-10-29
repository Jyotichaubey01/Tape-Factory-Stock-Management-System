export type UserRole = "ADMIN" | "STAFF";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type MaterialType = "FILM" | "ADHESIVE" | "CORES";
export type MaterialTransactionType = "RECEIPT" | "PRODUCTION_ISSUE" | "DAMAGE" | "CORRECTION";

export type OrderUnit = "ROLLS" | "METRES" | "NET_KG";

export interface MaterialBalanceSummary {
  filmKg: number;
  liquidAdhesiveKg: number;
  coresPcs: number;
}

export interface FinishedGoodsSummary {
  specificationId: number;
  specificationCode: string;
  onHandRolls: number;
  reservedRolls: number;
  availableRolls: number;
  metres: number;
  netTapeKg: number;
}
