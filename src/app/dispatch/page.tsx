"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { Truck, ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";

interface DispatchRecord {
  id: string;
  dispatchNumber: string;
  rollCount: number;
  notes?: string;
  createdAt: string;
  order: {
    orderNumber: string;
    customer: {
      name: string;
    };
    specification: {
      code: string;
    };
  };
  createdBy: {
    name: string;
  };
}

export default function DispatchesPage() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (data.orders) {
          // Extract dispatches from orders
          const allDs: DispatchRecord[] = [];
          for (const order of data.orders) {
            if (order.dispatches) {
              for (const d of order.dispatches) {
                allDs.push({
                  ...d,
                  order: {
                    orderNumber: order.orderNumber,
                    customer: order.customer,
                    specification: order.specification,
                  },
                });
              }
            }
          }
          allDs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setDispatches(allDs);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = dispatches.filter(
    (d) =>
      d.dispatchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.order?.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.order?.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Customer Dispatches
            </h1>
            <p className="text-sm text-slate-600">
              Outbound logistics records and physical warehouse shipments.
            </p>
          </div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Fulfill Pending Orders
          </Link>
        </div>

        {/* Table & Search */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Outbound Dispatch Registry</h2>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search dispatch, order or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-blue-600 focus:outline-none w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Dispatch Number</th>
                  <th className="px-6 py-3">Order Number</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Specification</th>
                  <th className="px-6 py-3">Dispatched Rolls</th>
                  <th className="px-6 py-3">Gate Pass Notes</th>
                  <th className="px-6 py-3">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length > 0 ? (
                  filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-blue-600">
                        {d.dispatchNumber}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {d.order?.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-slate-700">{d.order?.customer?.name}</td>
                      <td className="px-6 py-4 text-slate-600">{d.order?.specification?.code}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 font-bold">
                          {d.rollCount} Rolls
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {d.notes || "—"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                      No outbound dispatches recorded yet.
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
