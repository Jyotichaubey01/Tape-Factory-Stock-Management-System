"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Factory,
  Calculator,
  AlertCircle,
  CheckCircle2,
  Boxes,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { calculateBOM, verifyProductionBatch, PRODUCTION_TOLERANCE_KG } from "@/lib/bom";

interface Specification {
  id: string;
  code: string;
  widthMm: number;
  filmGsm: number;
  dryCoatingGsm: number;
  adhesiveSolidsPercent: number;
  rollLengthM: number;
}

interface BatchRecord {
  id: string;
  batchNumber: string;
  rollCount: number;
  filmIssuedKg: number;
  liquidAdhesiveIssuedKg: number;
  dryWastageKg: number;
  coresIssued: number;
  productionInputKg: number;
  productionOutputKg: number;
  productionDifferenceKg: number;
  createdAt: string;
  specification: {
    code: string;
  };
  createdBy: {
    name: string;
  };
}

export default function ProductionPage() {
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [rollCount, setRollCount] = useState(10);
  const [filmIssuedKg, setFilmIssuedKg] = useState(12.0);
  const [liquidAdhesiveIssuedKg, setLiquidAdhesiveIssuedKg] = useState(21.12);
  const [dryWastageKg, setDryWastageKg] = useState(0.0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [resSpecs, resBatches] = await Promise.all([
        fetch("/api/specifications"),
        fetch("/api/production"),
      ]);
      const dataSpecs = await resSpecs.json();
      const dataBatches = await resBatches.json();

      if (dataSpecs.specifications) {
        setSpecs(dataSpecs.specifications);
        if (!selectedSpecId && dataSpecs.specifications.length > 0) {
          setSelectedSpecId(dataSpecs.specifications[0].id);
        }
      }
      if (dataBatches.batches) {
        setBatches(dataBatches.batches);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    // Default batch number
    setBatchNumber(`BATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);

  const selectedSpec = specs.find((s) => s.id === selectedSpecId);

  // Autofill expected values when roll count or spec changes
  const autofillExpected = () => {
    if (!selectedSpec || rollCount <= 0) return;
    try {
      const bom = calculateBOM(
        {
          widthMm: selectedSpec.widthMm,
          filmGsm: selectedSpec.filmGsm,
          dryCoatingGsm: selectedSpec.dryCoatingGsm,
          adhesiveSolidsPercent: selectedSpec.adhesiveSolidsPercent,
          rollLengthM: selectedSpec.rollLengthM,
        },
        rollCount
      );
      setFilmIssuedKg(bom.filmKg.toNumber());
      setLiquidAdhesiveIssuedKg(bom.liquidAdhesiveKg.toNumber());
      setDryWastageKg(0);
    } catch (e) {}
  };

  // Live Mass Balance Calculation
  let liveVerification = null;
  if (selectedSpec && rollCount > 0 && filmIssuedKg > 0 && liquidAdhesiveIssuedKg > 0) {
    try {
      liveVerification = verifyProductionBatch({
        spec: {
          widthMm: selectedSpec.widthMm,
          filmGsm: selectedSpec.filmGsm,
          dryCoatingGsm: selectedSpec.dryCoatingGsm,
          adhesiveSolidsPercent: selectedSpec.adhesiveSolidsPercent,
          rollLengthM: selectedSpec.rollLengthM,
        },
        rollCount,
        actualFilmIssuedKg: filmIssuedKg,
        actualLiquidAdhesiveIssuedKg: liquidAdhesiveIssuedKg,
        dryWastageKg,
      });
    } catch (e) {
      liveVerification = null;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const idempotencyKey = `batch-${batchNumber}-${Date.now()}`;

    try {
      const res = await fetch("/api/production", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          batchNumber,
          specificationId: selectedSpecId,
          rollCount,
          filmIssuedKg,
          liquidAdhesiveIssuedKg,
          dryWastageKg,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to commit production batch");

      setSuccessMsg(
        `Production Batch "${batchNumber}" executed successfully! Stock deducted and +${rollCount} rolls added to finished goods.`
      );
      // Generate next batch number
      setBatchNumber(
        `BATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      );
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Production Execution & Mass-Balance
          </h1>
          <p className="text-sm text-slate-600">
            Enforces strict BOM mass-balance and atomic ledger movements. Rejects batches outside ±
            {PRODUCTION_TOLERANCE_KG.toFixed(3)} kg precision tolerance.
          </p>
        </div>

        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Batch Committed Successfully</p>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Production Validation Rejected</p>
              <p className="text-xs text-rose-700 mt-0.5 whitespace-pre-line">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Main Production Entry Form */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <Factory className="h-5 w-5 text-blue-600" />
                Record Manufacturing Run
              </h2>
              <button
                type="button"
                onClick={autofillExpected}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Autofill Expected Quantities
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                    Batch Number (Unique)
                  </label>
                  <input
                    type="text"
                    required
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm font-semibold focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                    Tape Specification
                  </label>
                  <select
                    value={selectedSpecId}
                    onChange={(e) => setSelectedSpecId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {specs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} ({s.widthMm}mm, {s.filmGsm} GSM, {s.rollLengthM}m)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Rolls to Produce (Whole Integer)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={rollCount}
                  onChange={(e) => setRollCount(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  1 Core will be deducted per finished whole roll ({rollCount} cores total).
                </p>
              </div>

              {/* Material Issues Grid */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Floor Materials Issued vs Expected BOM
                </span>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Film Issued (kg)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={filmIssuedKg}
                      onChange={(e) => setFilmIssuedKg(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-sm font-semibold focus:border-blue-600 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Expected: {liveVerification ? liveVerification.expectedFilmKg.toFixed(3) : "—"} kg
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Liquid Adhesive Issued (kg)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={liquidAdhesiveIssuedKg}
                      onChange={(e) => setLiquidAdhesiveIssuedKg(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-sm font-semibold focus:border-blue-600 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Expected:{" "}
                      {liveVerification ? liveVerification.expectedLiquidAdhesiveKg.toFixed(3) : "—"} kg
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Dry Wastage Scrapped (kg)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      required
                      value={dryWastageKg}
                      onChange={(e) => setDryWastageKg(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-sm font-semibold focus:border-blue-600 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Extra consumed material
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (liveVerification ? !liveVerification.isWithinTolerance : false)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Factory className="h-4 w-4" />
                    Execute Production Batch & Post to Ledger
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Mass-Balance Real-Time Diagnostics Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3">
              Mass-Balance Verification
            </h3>

            {liveVerification ? (
              <div className="space-y-4">
                <div
                  className={`rounded-lg p-4 border text-xs ${
                    liveVerification.isWithinTolerance
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {liveVerification.isWithinTolerance ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    )}
                    {liveVerification.isWithinTolerance ? "Within Tolerance" : "Rejected: Mismatch"}
                  </div>
                  <p>{liveVerification.differenceSummary}</p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Actual Dry Adhesive:</span>
                    <span className="font-semibold text-slate-900">
                      {liveVerification.actualDryAdhesiveKg.toFixed(3)} kg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Production Input Kg:</span>
                    <span className="font-semibold text-slate-900">
                      {liveVerification.productionInputKg.toFixed(3)} kg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Net Tape Produced:</span>
                    <span className="font-semibold text-slate-900">
                      {liveVerification.netTapeProducedKg.toFixed(3)} kg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Dry Wastage:</span>
                    <span className="font-semibold text-slate-900">
                      {liveVerification.dryWastageKg.toFixed(3)} kg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Production Output Kg:</span>
                    <span className="font-semibold text-slate-900">
                      {liveVerification.productionOutputKg.toFixed(3)} kg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 pt-2 font-bold">
                    <span className="text-slate-700">Mass Difference:</span>
                    <span
                      className={
                        liveVerification.isWithinTolerance ? "text-emerald-600" : "text-rose-600"
                      }
                    >
                      {liveVerification.productionDifferenceKg.toFixed(4)} kg
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500">
                  Tolerance Threshold: ±{PRODUCTION_TOLERANCE_KG.toFixed(3)} kg (50 grams)
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Enter roll count and material quantities to preview mass-balance.
              </p>
            )}
          </div>
        </div>

        {/* Historical Production Batches Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Completed Production Batches</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Batch Number</th>
                  <th className="px-6 py-3">Specification</th>
                  <th className="px-6 py-3">Rolls Produced</th>
                  <th className="px-6 py-3">Film Issued</th>
                  <th className="px-6 py-3">Liquid Adhesive</th>
                  <th className="px-6 py-3">Wastage</th>
                  <th className="px-6 py-3">Difference</th>
                  <th className="px-6 py-3">Operator</th>
                  <th className="px-6 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.length > 0 ? (
                  batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-semibold text-slate-900">{b.batchNumber}</td>
                      <td className="px-6 py-3.5 text-slate-700">{b.specification?.code}</td>
                      <td className="px-6 py-3.5 font-bold text-emerald-600">
                        +{b.rollCount} Rolls
                      </td>
                      <td className="px-6 py-3.5 text-slate-700">
                        {Number(b.filmIssuedKg).toFixed(3)} kg
                      </td>
                      <td className="px-6 py-3.5 text-slate-700">
                        {Number(b.liquidAdhesiveIssuedKg).toFixed(3)} kg
                      </td>
                      <td className="px-6 py-3.5 text-slate-700">
                        {Number(b.dryWastageKg).toFixed(3)} kg
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600">
                        {Number(b.productionDifferenceKg).toFixed(4)} kg
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-700">
                        {b.createdBy?.name || "Staff"}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-sm text-slate-500">
                      No production batches recorded yet.
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
