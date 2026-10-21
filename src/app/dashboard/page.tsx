"use client";

import React, { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Boxes,
  Factory,
  PackageCheck,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Layers,
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  metrics: {
    rawMaterials: {
      filmKg: number;
      liquidAdhesiveKg: number;
      coresPcs: number;
    };
    finishedGoods: {
      totalAvailableRolls: number;
      totalNetTapeKg: number;
      totalMetres: number;
      details: Array<{
        specificationId: string;
        specificationCode: string;
        onHandRolls: number;
        reservedRolls: number;
        availableRolls: number;
        netTapeKg: number;
        metres: number;
      }>;
    };
    openOrdersCount: number;
  };
  recentBatches: any[];
  recentOrders: any[];
  recentAudits: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((err) => console.error("Error loading dashboard:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Operations Dashboard
            </h1>
            <p className="text-sm text-slate-600">
              Live floor inventory, production mass balances, and order fulfillment status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/production"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Factory className="h-4 w-4" />
              New Production Batch
            </Link>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              New Order
            </Link>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Film Stock */}
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
              <span className="text-2xl font-bold text-slate-900">
                {data ? Number(data.metrics.rawMaterials.filmKg).toFixed(3) : "—"}
              </span>
              <span className="text-xs font-medium text-slate-500 ml-1.5">kg</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>On-hand raw inventory</span>
              <Link href="/inventory/materials" className="text-blue-600 hover:underline">
                View Ledger &rarr;
              </Link>
            </div>
          </div>

          {/* Card 2: Liquid Adhesive Stock */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Liquid Adhesive (50% Solids)
              </span>
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-slate-900">
                {data ? Number(data.metrics.rawMaterials.liquidAdhesiveKg).toFixed(3) : "—"}
              </span>
              <span className="text-xs font-medium text-slate-500 ml-1.5">kg</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>Cores: {data ? data.metrics.rawMaterials.coresPcs : "—"} pcs</span>
              <Link href="/inventory/receipts" className="text-blue-600 hover:underline">
                + Receive &rarr;
              </Link>
            </div>
          </div>

          {/* Card 3: Finished Goods Available Rolls */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Finished Tape Rolls
              </span>
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <PackageCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-slate-900">
                {data ? data.metrics.finishedGoods.totalAvailableRolls : "—"}
              </span>
              <span className="text-xs font-medium text-slate-500 ml-1.5">available rolls</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>
                Net: {data ? Number(data.metrics.finishedGoods.totalNetTapeKg).toFixed(3) : "—"} kg
              </span>
              <Link href="/inventory/finished-goods" className="text-blue-600 hover:underline">
                Details &rarr;
              </Link>
            </div>
          </div>

          {/* Card 4: Open Sales Orders */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Sales Orders
              </span>
              <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-slate-900">
                {data ? data.metrics.openOrdersCount : "—"}
              </span>
              <span className="text-xs font-medium text-slate-500 ml-1.5">pending fulfillment</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>Stock reserved automatically</span>
              <Link href="/orders" className="text-blue-600 hover:underline">
                Manage &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Finished Goods By Specification Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="font-semibold text-slate-900">Finished Stock by Tape Specification</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical on-hand rolls, active customer reservations, and net available to promise.
              </p>
            </div>
            <Link
              href="/inventory/finished-goods"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              Full Warehouse Table
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Specification Code</th>
                  <th className="px-6 py-3">Physical On-Hand</th>
                  <th className="px-6 py-3">Reserved (Active Orders)</th>
                  <th className="px-6 py-3">Net Available</th>
                  <th className="px-6 py-3">Derived Metres</th>
                  <th className="px-6 py-3">Derived Net Tape Kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.metrics.finishedGoods.details && data.metrics.finishedGoods.details.length > 0 ? (
                  data.metrics.finishedGoods.details.map((item) => (
                    <tr key={item.specificationId} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-semibold text-slate-900">
                        {item.specificationCode}
                      </td>
                      <td className="px-6 py-3.5 text-slate-700">{item.onHandRolls} rolls</td>
                      <td className="px-6 py-3.5 text-amber-600 font-medium">
                        {item.reservedRolls} rolls
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            item.availableRolls > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.availableRolls} rolls
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {Number(item.metres).toLocaleString()} m
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-900">
                        {Number(item.netTapeKg).toFixed(3)} kg
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                      No tape specifications or finished goods recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Two Column Grid: Recent Batches & Recent Orders */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Production Batches */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Factory className="h-4 w-4 text-blue-600" />
                Recent Production Batches
              </h2>
              <Link href="/production" className="text-xs font-semibold text-blue-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data?.recentBatches && data.recentBatches.length > 0 ? (
                data.recentBatches.map((b) => (
                  <div key={b.id} className="p-4 hover:bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{b.batchNumber}</span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        +{b.rollCount} Rolls
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{b.specification?.code}</span>
                      <span>Diff: {Number(b.productionDifferenceKg).toFixed(4)} kg</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  No production batches recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-indigo-600" />
                Recent Sales Orders
              </h2>
              <Link href="/orders" className="text-xs font-semibold text-blue-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data?.recentOrders && data.recentOrders.length > 0 ? (
                data.recentOrders.map((o) => (
                  <div key={o.id} className="p-4 hover:bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{o.orderNumber}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          o.status === "FULFILLED"
                            ? "bg-emerald-100 text-emerald-800"
                            : o.status === "CANCELLED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{o.customer?.name}</span>
                      <span>
                        {o.dispatchedRolls}/{o.orderedRolls} Rolls Dispatched
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  No sales orders recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
