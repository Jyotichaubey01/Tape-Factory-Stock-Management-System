"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  PackageCheck,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Boxes,
} from "lucide-react";
import Link from "next/link";

interface FinishedGoodStock {
  specificationId: string;
  specificationCode: string;
  onHandRolls: number;
  reservedRolls: number;
  availableRolls: number;
  metres: number;
  netTapeKg: number;
}

interface FinishedGoodLedgerItem {
  id: string;
  specification: {
    code: string;
  };
  transactionType: string;
  rollCount: number;
  netTapeKg: number;
  metres: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdAt: string;
  user: {
    name: string;
  };
}

export default function FinishedGoodsPage() {
  const [stock, setStock] = useState<FinishedGoodStock[]>([]);
  const [ledger, setLedger] = useState<FinishedGoodLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inventory/finished-goods")
      .then((res) => res.json())
      .then((data) => {
        if (data.stock) setStock(data.stock);
        if (data.ledger) setLedger(data.ledger);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const totalOnHand = stock.reduce((acc, s) => acc + s.onHandRolls, 0);
  const totalReserved = stock.reduce((acc, s) => acc + s.reservedRolls, 0);
  const totalAvailable = stock.reduce((acc, s) => acc + s.availableRolls, 0);
  const totalNetKg = stock.reduce((acc, s) => acc + s.netTapeKg, 0);

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Finished Goods Warehouse
            </h1>
            <p className="text-sm text-slate-600">
              Stock tracked in whole rolls by specification. Metres and Net Tape KG are mathematically derived and non-editable.
            </p>
          </div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Create Customer Order
          </Link>
        </div>

        {/* Aggregate KPI summary */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Physical On-Hand Rolls
            </span>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalOnHand} rolls</div>
            <p className="text-xs text-slate-500 mt-1">Total rolls in warehouse floor</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Reservations
            </span>
            <div className="mt-2 text-2xl font-bold text-amber-600">{totalReserved} rolls</div>
            <p className="text-xs text-slate-500 mt-1">Locked for pending sales orders</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Available to Promise
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{totalAvailable} rolls</div>
            <p className="text-xs text-slate-500 mt-1">On-hand minus active reservations</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Net Tape Weight
            </span>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {Number(totalNetKg).toFixed(3)} kg
            </div>
            <p className="text-xs text-slate-500 mt-1">Derived from specification BOM</p>
          </div>
        </div>

        {/* Stock Breakdown by Specification */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Stock Availability per Specification</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Specification</th>
                  <th className="px-6 py-3">Physical On-Hand</th>
                  <th className="px-6 py-3">Customer Reserved</th>
                  <th className="px-6 py-3">Net Available</th>
                  <th className="px-6 py-3">Total Metres (Derived)</th>
                  <th className="px-6 py-3">Total Net Tape Kg (Derived)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stock.length > 0 ? (
                  stock.map((s) => (
                    <tr key={s.specificationId} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {s.specificationCode}
                      </td>
                      <td className="px-6 py-4 text-slate-700">{s.onHandRolls} rolls</td>
                      <td className="px-6 py-4 font-medium text-amber-600">
                        {s.reservedRolls} rolls
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            s.availableRolls > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.availableRolls} rolls
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {Number(s.metres).toLocaleString()} m
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {Number(s.netTapeKg).toFixed(3)} kg
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                      No finished stock records available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Finished Goods Movements Ledger */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Finished Goods Movements Ledger</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Specification</th>
                  <th className="px-6 py-3">Transaction</th>
                  <th className="px-6 py-3">Rolls</th>
                  <th className="px-6 py-3">Net Tape Kg</th>
                  <th className="px-6 py-3">Metres</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.length > 0 ? (
                  ledger.map((l) => {
                    const isPositive = l.rollCount > 0;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          {l.specification?.code}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                              l.transactionType === "PRODUCTION_RECEIPT"
                                ? "bg-emerald-100 text-emerald-800"
                                : l.transactionType === "CORRECTION"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {isPositive ? (
                              <ArrowDownLeft className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {l.transactionType}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-bold">
                          <span className={isPositive ? "text-emerald-600" : "text-slate-800"}>
                            {isPositive ? "+" : ""}
                            {l.rollCount} Rolls
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-700">
                          {Number(l.netTapeKg).toFixed(3)} kg
                        </td>
                        <td className="px-6 py-3.5 text-slate-600">
                          {Number(l.metres).toLocaleString()} m
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-600">{l.referenceId || "—"}</td>
                        <td className="px-6 py-3.5 text-xs text-slate-700">{l.user?.name || "System"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                      No finished goods ledger movements recorded yet.
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
