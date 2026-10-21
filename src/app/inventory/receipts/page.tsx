"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { PackagePlus, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StockReceiptsPage() {
  const router = useRouter();
  const [materialType, setMaterialType] = useState<"FILM" | "LIQUID_ADHESIVE" | "CORE">("FILM");
  const [quantity, setQuantity] = useState<number>(100);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Client idempotency key to prevent double submissions
    const idempotencyKey = `rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch("/api/inventory/materials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          materialType,
          quantity,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to receive material");

      setSuccessMsg(
        `Successfully received ${quantity} ${materialType === "CORE" ? "PCS" : "KG"} of ${materialType} into inventory!`
      );
      setNotes("");
      if (materialType === "CORE") setQuantity(100);
      else setQuantity(50);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Receive Raw Materials
          </h1>
          <p className="text-sm text-slate-600">
            Log incoming supplier shipments into the append-only material ledger.
          </p>
        </div>

        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Receipt Recorded</p>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Receipt Failed</p>
              <p className="text-xs text-rose-700 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Raw Material Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setMaterialType("FILM")}
                  className={`flex flex-col items-center justify-center rounded-lg border p-4 text-center transition-colors ${
                    materialType === "FILM"
                      ? "border-blue-600 bg-blue-50/60 text-blue-900 font-bold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm">BOPP / PET Film</span>
                  <span className="text-xs text-slate-500 mt-1">Unit: KG</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMaterialType("LIQUID_ADHESIVE")}
                  className={`flex flex-col items-center justify-center rounded-lg border p-4 text-center transition-colors ${
                    materialType === "LIQUID_ADHESIVE"
                      ? "border-blue-600 bg-blue-50/60 text-blue-900 font-bold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm">Liquid Adhesive</span>
                  <span className="text-xs text-slate-500 mt-1">50% Solids (KG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMaterialType("CORE")}
                  className={`flex flex-col items-center justify-center rounded-lg border p-4 text-center transition-colors ${
                    materialType === "CORE"
                      ? "border-blue-600 bg-blue-50/60 text-blue-900 font-bold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm">Paper Cores</span>
                  <span className="text-xs text-slate-500 mt-1">Unit: PCS</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Quantity to Receive ({materialType === "CORE" ? "Whole Pieces" : "Kilograms"})
              </label>
              <input
                type="number"
                step={materialType === "CORE" ? "1" : "0.001"}
                min="0.001"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-base font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Display format conforms to exact internal decimal storage.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Supplier Delivery Notes / Batch Invoice Ref
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Supplier PO #9021, Delivery truck #HR-55-A-1204"
                className="w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <PackagePlus className="h-4 w-4" />
                    Commit Stock Receipt to Ledger
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
