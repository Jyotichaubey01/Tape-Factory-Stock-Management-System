"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Boxes,
  PackagePlus,
  AlertOctagon,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface MaterialBalances {
  filmKg: number;
  liquidAdhesiveKg: number;
  coresPcs: number;
}

interface LedgerItem {
  id: string;
  materialType: "FILM" | "LIQUID_ADHESIVE" | "CORE";
  transactionType: string;
  quantity: number;
  unit: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

export default function MaterialsInventoryPage() {
  const [balances, setBalances] = useState<MaterialBalances | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");

  // Damage / Scrap modal
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageType, setDamageType] = useState<"FILM" | "LIQUID_ADHESIVE" | "CORE">("FILM");
  const [damageQty, setDamageQty] = useState(1);
  const [damageNotes, setDamageNotes] = useState("");
  const [damageError, setDamageError] = useState<string | null>(null);
  const [submittingDamage, setSubmittingDamage] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/inventory/materials");
      const data = await res.json();
      if (data.balances) setBalances(data.balances);
      if (data.ledger) setLedger(data.ledger);
    } catch (err) {
      console.error("Failed to load material data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDamage(true);
    setDamageError(null);

    try {
      const res = await fetch("/api/inventory/materials/damage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialType: damageType,
          quantity: damageQty,
          notes: damageNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record damage");

      setShowDamageModal(false);
      setDamageNotes("");
      setDamageQty(1);
      fetchData();
    } catch (err: any) {
      setDamageError(err.message);
    } finally {
      setSubmittingDamage(false);
    }
  };

  const filteredLedger =
    filterType === "ALL" ? ledger : ledger.filter((l) => l.materialType === filterType);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Raw Material Inventory & Ledger
            </h1>
            <p className="text-sm text-slate-600">
              Append-only material ledger. Balances are mathematically derived from receipts, production issues, and scraps.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/inventory/receipts"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <PackagePlus className="h-4 w-4" />
              Receive Materials
            </Link>
            <button
              onClick={() => {
                setDamageError(null);
                setShowDamageModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
            >
              <AlertOctagon className="h-4 w-4" />
              Record Damage / Scrap
            </button>
          </div>
        </div>

        {/* Live Balances Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {/* Film */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Film Stock (BOPP/PET)
              </span>
              <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold text-slate-900">
                {balances ? Number(balances.filmKg).toFixed(3) : "—"}
              </span>
              <span className="text-sm font-medium text-slate-500 ml-1.5">kg</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Unit: Kilograms (Exact 3-decimal display)
            </p>
          </div>

          {/* Liquid Adhesive */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Liquid Adhesive
              </span>
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold text-slate-900">
                {balances ? Number(balances.liquidAdhesiveKg).toFixed(3) : "—"}
              </span>
              <span className="text-sm font-medium text-slate-500 ml-1.5">kg</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Solids Percentage: 50% formulation standard
            </p>
          </div>

          {/* Cores */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Paper Cores
              </span>
              <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold text-slate-900">
                {balances ? balances.coresPcs : "—"}
              </span>
              <span className="text-sm font-medium text-slate-500 ml-1.5">pieces</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Consumption: Exactly 1 core consumed per finished roll
            </p>
          </div>
        </div>

        {/* Append-Only Ledger Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="font-semibold text-slate-900">Append-Only Material Transaction Ledger</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every material movement is logged with user identity, timestamp, and audit reference.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-1 px-2.5 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Materials</option>
                <option value="FILM">Film Only</option>
                <option value="LIQUID_ADHESIVE">Liquid Adhesive Only</option>
                <option value="CORE">Cores Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Material</th>
                  <th className="px-6 py-3">Transaction Type</th>
                  <th className="px-6 py-3">Quantity</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-6 py-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLedger.length > 0 ? (
                  filteredLedger.map((row) => {
                    const isPositive = Number(row.quantity) > 0;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          {row.materialType}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                              row.transactionType === "RECEIPT"
                                ? "bg-emerald-100 text-emerald-800"
                                : row.transactionType === "DAMAGE"
                                ? "bg-rose-100 text-rose-800"
                                : row.transactionType === "CORRECTION"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {isPositive ? (
                              <ArrowDownLeft className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {row.transactionType}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-bold">
                          <span className={isPositive ? "text-emerald-600" : "text-slate-800"}>
                            {isPositive ? "+" : ""}
                            {Number(row.quantity).toFixed(row.unit === "PCS" ? 0 : 3)} {row.unit}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-600">
                          {row.referenceId || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-500 max-w-xs truncate">
                          {row.notes || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-700">
                          {row.user?.name || "System"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                      No material ledger entries recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Damage / Scrap Modal */}
        {showDamageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-rose-600" />
                  Record Material Damage / Scrap
                </h3>
                <button
                  onClick={() => setShowDamageModal(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {damageError && (
                <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>{damageError}</div>
                </div>
              )}

              <form onSubmit={handleRecordDamage} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Material Type
                  </label>
                  <select
                    value={damageType}
                    onChange={(e) => setDamageType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="FILM">Film (kg)</option>
                    <option value="LIQUID_ADHESIVE">Liquid Adhesive (kg)</option>
                    <option value="CORE">Paper Cores (pcs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Damage Quantity to Deduct ({damageType === "CORE" ? "PCS" : "KG"})
                  </label>
                  <input
                    type="number"
                    step={damageType === "CORE" ? "1" : "0.001"}
                    min="0.001"
                    required
                    value={damageQty}
                    onChange={(e) => setDamageQty(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Current available:{" "}
                    {damageType === "FILM"
                      ? `${Number(balances?.filmKg || 0).toFixed(3)} kg`
                      : damageType === "LIQUID_ADHESIVE"
                      ? `${Number(balances?.liquidAdhesiveKg || 0).toFixed(3)} kg`
                      : `${balances?.coresPcs || 0} pcs`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Damage Reason / Scrap Report Notes
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="e.g. Moisture contamination in adhesive drum batch ADH-992"
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowDamageModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDamage}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {submittingDamage ? "Recording..." : "Record Scrap"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
