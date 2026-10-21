"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Layers,
  Plus,
  Calculator,
  Lock,
  GitBranch,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { calculateBOM } from "@/lib/bom";

interface Specification {
  id: string;
  code: string;
  version: number;
  widthMm: number;
  filmGsm: number;
  dryCoatingGsm: number;
  adhesiveSolidsPercent: number;
  rollLengthM: number;
  isUsedForProduction: boolean;
  createdAt: string;
}

export default function SpecificationsPage() {
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [versioningSpec, setVersioningSpec] = useState<Specification | null>(null);

  // Form states
  const [code, setCode] = useState("");
  const [widthMm, setWidthMm] = useState(48);
  const [filmGsm, setFilmGsm] = useState(25);
  const [dryCoatingGsm, setDryCoatingGsm] = useState(22);
  const [adhesiveSolidsPercent, setAdhesiveSolidsPercent] = useState(50);
  const [rollLengthM, setRollLengthM] = useState(1000);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // BOM Calculator state
  const [calcRollCount, setCalcRollCount] = useState(1);
  const [selectedSpecForCalc, setSelectedSpecForCalc] = useState<Specification | null>(null);

  const fetchSpecs = async () => {
    try {
      const res = await fetch("/api/specifications");
      const data = await res.json();
      if (data.specifications) {
        setSpecs(data.specifications);
        if (!selectedSpecForCalc && data.specifications.length > 0) {
          setSelectedSpecForCalc(data.specifications[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load specifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecs();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/specifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          widthMm,
          filmGsm,
          dryCoatingGsm,
          adhesiveSolidsPercent,
          rollLengthM,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create specification");

      setShowCreateModal(false);
      resetForm();
      fetchSpecs();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versioningSpec) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/specifications/${versioningSpec.id}/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widthMm,
          filmGsm,
          dryCoatingGsm,
          adhesiveSolidsPercent,
          rollLengthM,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to version specification");

      setVersioningSpec(null);
      resetForm();
      fetchSpecs();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCode("");
    setWidthMm(48);
    setFilmGsm(25);
    setDryCoatingGsm(22);
    setAdhesiveSolidsPercent(50);
    setRollLengthM(1000);
    setFormError(null);
  };

  const openVersionModal = (s: Specification) => {
    setVersioningSpec(s);
    setWidthMm(Number(s.widthMm));
    setFilmGsm(Number(s.filmGsm));
    setDryCoatingGsm(Number(s.dryCoatingGsm));
    setAdhesiveSolidsPercent(Number(s.adhesiveSolidsPercent));
    setRollLengthM(Number(s.rollLengthM));
  };

  // Live BOM Simulation Calculation
  let liveBom = null;
  if (selectedSpecForCalc && calcRollCount > 0) {
    try {
      liveBom = calculateBOM(
        {
          widthMm: selectedSpecForCalc.widthMm,
          filmGsm: selectedSpecForCalc.filmGsm,
          dryCoatingGsm: selectedSpecForCalc.dryCoatingGsm,
          adhesiveSolidsPercent: selectedSpecForCalc.adhesiveSolidsPercent,
          rollLengthM: selectedSpecForCalc.rollLengthM,
        },
        calcRollCount
      );
    } catch (e) {
      liveBom = null;
    }
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Tape Specifications & BOM
            </h1>
            <p className="text-sm text-slate-600">
              Technical manufacturing standards and Bill of Materials formulation rules.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Specification
          </button>
        </div>

        {/* Live BOM Calculator Box */}
        {selectedSpecForCalc && (
          <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-200/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-blue-600 p-2 text-white">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Interactive BOM Simulator: {selectedSpecForCalc.code}
                  </h2>
                  <p className="text-xs text-slate-600">
                    {selectedSpecForCalc.widthMm}mm width &bull; {selectedSpecForCalc.filmGsm} GSM
                    film &bull; {selectedSpecForCalc.dryCoatingGsm} GSM coating &bull;{" "}
                    {selectedSpecForCalc.adhesiveSolidsPercent}% solids &bull;{" "}
                    {selectedSpecForCalc.rollLengthM}m length
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase text-slate-700">Roll Count:</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={calcRollCount}
                  onChange={(e) => setCalcRollCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {liveBom && (
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 text-center">
                <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-xs">
                  <span className="block text-[11px] font-semibold uppercase text-slate-500">
                    Area Coverage
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {liveBom.areaM2.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">m²</span>
                </div>

                <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-xs">
                  <span className="block text-[11px] font-semibold uppercase text-slate-500">
                    Raw Film
                  </span>
                  <span className="text-lg font-bold text-sky-700">
                    {liveBom.filmKg.toFixed(3)}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">kg</span>
                </div>

                <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-xs">
                  <span className="block text-[11px] font-semibold uppercase text-slate-500">
                    Dry Adhesive
                  </span>
                  <span className="text-lg font-bold text-amber-700">
                    {liveBom.dryAdhesiveKg.toFixed(3)}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">kg</span>
                </div>

                <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-xs">
                  <span className="block text-[11px] font-semibold uppercase text-slate-500">
                    Liquid Adhesive
                  </span>
                  <span className="text-lg font-bold text-indigo-700">
                    {liveBom.liquidAdhesiveKg.toFixed(3)}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">kg</span>
                </div>

                <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-xs">
                  <span className="block text-[11px] font-semibold uppercase text-slate-500">
                    Cores
                  </span>
                  <span className="text-lg font-bold text-slate-900">{liveBom.cores}</span>
                  <span className="text-xs text-slate-500 ml-1">pcs</span>
                </div>

                <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-xs">
                  <span className="block text-[11px] font-semibold uppercase text-slate-500">
                    Net Tape Weight
                  </span>
                  <span className="text-lg font-bold text-emerald-700">
                    {liveBom.netTapeKg.toFixed(3)}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">kg</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Specifications List Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Registered Specifications</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specifications used in production are permanently immutable. Versioning creates a linked next-generation specification.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Code & Version</th>
                  <th className="px-6 py-3">Width</th>
                  <th className="px-6 py-3">Film GSM</th>
                  <th className="px-6 py-3">Coating GSM</th>
                  <th className="px-6 py-3">Solids %</th>
                  <th className="px-6 py-3">Roll Length</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {specs.length > 0 ? (
                  specs.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSpecForCalc(s)}
                      className={`cursor-pointer hover:bg-slate-50/70 ${
                        selectedSpecForCalc?.id === s.id ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{s.code}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            v{s.version}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{s.widthMm} mm</td>
                      <td className="px-6 py-4 text-slate-700">{s.filmGsm} GSM</td>
                      <td className="px-6 py-4 text-slate-700">{s.dryCoatingGsm} GSM</td>
                      <td className="px-6 py-4 text-slate-700">{s.adhesiveSolidsPercent}%</td>
                      <td className="px-6 py-4 text-slate-700">{s.rollLengthM} m</td>
                      <td className="px-6 py-4">
                        {s.isUsedForProduction ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            <Lock className="h-3 w-3 text-slate-500" />
                            Locked (Used in Prod)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Draft / Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openVersionModal(s);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
                        >
                          <GitBranch className="h-3.5 w-3.5 text-blue-600" />
                          New Version
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                      No specifications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900">Create New Specification</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Specification Code
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. SPEC-48-1000-HEAVY"
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Width (mm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={widthMm}
                      onChange={(e) => setWidthMm(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Roll Length (m)
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={rollLengthM}
                      onChange={(e) => setRollLengthM(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Film GSM
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={filmGsm}
                      onChange={(e) => setFilmGsm(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Coating GSM
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={dryCoatingGsm}
                      onChange={(e) => setDryCoatingGsm(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Solids %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="100"
                      required
                      value={adhesiveSolidsPercent}
                      onChange={(e) => setAdhesiveSolidsPercent(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Create Specification"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Version Modal */}
        {versioningSpec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  Version Specification: {versioningSpec.code}
                </h3>
                <button
                  onClick={() => setVersioningSpec(null)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mt-2">
                This will create version {versioningSpec.version + 1} ({versioningSpec.code}-v
                {versioningSpec.version + 1}). The original specification and all related batch history remain preserved.
              </p>

              {formError && (
                <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateVersion} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Width (mm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={widthMm}
                      onChange={(e) => setWidthMm(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Roll Length (m)
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={rollLengthM}
                      onChange={(e) => setRollLengthM(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Film GSM
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={filmGsm}
                      onChange={(e) => setFilmGsm(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Coating GSM
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={dryCoatingGsm}
                      onChange={(e) => setDryCoatingGsm(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Solids %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="100"
                      required
                      value={adhesiveSolidsPercent}
                      onChange={(e) => setAdhesiveSolidsPercent(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setVersioningSpec(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Save New Version"}
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
