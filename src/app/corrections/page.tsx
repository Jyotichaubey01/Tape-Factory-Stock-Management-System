"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { ShieldAlert, AlertCircle, CheckCircle2, Shield, Lock } from "lucide-react";

interface CorrectionRecord {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  priorDataJson: string;
  correctionDataJson: string;
  createdAt: string;
  admin: {
    name: string;
    email: string;
  };
}

interface Spec {
  id: string;
  code: string;
}

export default function AdminCorrectionsPage() {
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [targetType, setTargetType] = useState<"MATERIAL_LEDGER" | "FINISHED_GOODS_LEDGER">(
    "MATERIAL_LEDGER"
  );
  const [materialType, setMaterialType] = useState<"FILM" | "LIQUID_ADHESIVE" | "CORE">("FILM");
  const [specificationId, setSpecificationId] = useState("");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchData = async () => {
    try {
      const [resCorr, resSpecs] = await Promise.all([
        fetch("/api/corrections"),
        fetch("/api/specifications"),
      ]);

      if (resCorr.status === 403) {
        setIsForbidden(true);
        return;
      }

      const dataCorr = await resCorr.json();
      const dataSpecs = await resSpecs.json();

      if (dataCorr.corrections) setCorrections(dataCorr.corrections);
      if (dataSpecs.specifications) {
        setSpecs(dataSpecs.specifications);
        if (!specificationId && dataSpecs.specifications.length > 0) {
          setSpecificationId(dataSpecs.specifications[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          materialType: targetType === "MATERIAL_LEDGER" ? materialType : undefined,
          specificationId: targetType === "FINISHED_GOODS_LEDGER" ? specificationId : undefined,
          adjustmentQuantity,
          reason,
          correctionAction: "ADJUST_STOCK",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Correction failed");

      setSuccessMsg(
        `Admin Stock Correction committed to ledger. Linked Audit ID: ${data.record.id}`
      );
      setReason("");
      setAdjustmentQuantity(0);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isForbidden) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-rose-200">
          <div className="rounded-full bg-rose-100 p-4 text-rose-600 mb-4">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">HTTP 403 Forbidden: Staff Access Restricted</h2>
          <p className="max-w-md text-sm text-slate-600 mt-2">
            You are signed in as Staff. Only System Administrators with role ADMIN possess authorization to perform stock corrections.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-purple-600" />
            Admin Stock Corrections & Overrides
          </h1>
          <p className="text-sm text-slate-600">
            Mandatory audit reasons are enforced. Prior records are never deleted; an offsetting linked correction record is atomically committed.
          </p>
        </div>

        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Correction Approved & Committed</p>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Correction Rejected</p>
              <p className="text-xs text-rose-700 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Correction Form */}
        <div className="rounded-xl border border-purple-200 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-600" />
            Post Certified Administrative Correction
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Target Inventory
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType("MATERIAL_LEDGER")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      targetType === "MATERIAL_LEDGER"
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Raw Material Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("FINISHED_GOODS_LEDGER")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      targetType === "FINISHED_GOODS_LEDGER"
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Finished Goods Ledger
                  </button>
                </div>
              </div>

              {targetType === "MATERIAL_LEDGER" ? (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                    Raw Material Type
                  </label>
                  <select
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-purple-600 focus:outline-none"
                  >
                    <option value="FILM">Film (BOPP/PET) [kg]</option>
                    <option value="LIQUID_ADHESIVE">Liquid Adhesive [kg]</option>
                    <option value="CORE">Paper Cores [pcs]</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                    Tape Specification
                  </label>
                  <select
                    value={specificationId}
                    onChange={(e) => setSpecificationId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-purple-600 focus:outline-none"
                  >
                    {specs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                Adjustment Quantity (+ to Add, - to Deduct)
              </label>
              <input
                type="number"
                step={
                  targetType === "MATERIAL_LEDGER" && materialType !== "CORE" ? "0.001" : "1"
                }
                required
                value={adjustmentQuantity}
                onChange={(e) => setAdjustmentQuantity(parseFloat(e.target.value) || 0)}
                placeholder="e.g. -5 or +10"
                className="w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-base font-bold text-slate-900 focus:border-purple-600 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Correction will be validated against active customer reservations and negative stock invariants.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                Mandatory Audit Justification (Min 10 characters)
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Physical inventory reconciliation count revealed +10 rolls of SPEC-48-1000-STD in bay 4."
                className="w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || adjustmentQuantity === 0 || reason.trim().length < 10}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3 px-4 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" />
                    Commit Certified Correction Record
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Historical Correction Records */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Correction Audit Log</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Target</th>
                  <th className="px-6 py-3">Justification Reason</th>
                  <th className="px-6 py-3">Prior State</th>
                  <th className="px-6 py-3">Correction Details</th>
                  <th className="px-6 py-3">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {corrections.length > 0 ? (
                  corrections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-slate-900">
                        {c.targetType}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-700 max-w-xs">{c.reason}</td>
                      <td className="px-6 py-3.5 text-xs font-mono text-slate-600 max-w-xs truncate">
                        {c.priorDataJson}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-mono text-purple-700 max-w-xs truncate">
                        {c.correctionDataJson}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-semibold text-slate-800">
                        {c.admin?.name || "Admin"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                      No administrative corrections recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
