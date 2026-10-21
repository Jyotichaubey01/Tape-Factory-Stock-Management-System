"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { History, Shield, Search, Filter } from "lucide-react";

interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  detailsJson?: string;
  userId: string;
  userRole: string;
  ipAddress?: string;
  createdAt: string;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");

  useEffect(() => {
    fetch("/api/audit-logs")
      .then((res) => res.json())
      .then((data) => {
        if (data.logs) setLogs(data.logs);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.detailsJson && log.detailsJson.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = filterAction === "ALL" || log.action === filterAction;

    return matchesSearch && matchesAction;
  });

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Audit Trail & Transaction History
          </h1>
          <p className="text-sm text-slate-600">
            Immutable system-wide ledger of operational and administrative actions for regulatory compliance.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Audit Events</h2>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search actions or entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-blue-600 focus:outline-none w-56"
                />
              </div>

              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Actions</option>
                <option value="RECORD_PRODUCTION_BATCH">Production Batches</option>
                <option value="CREATE_SALES_ORDER">Sales Orders</option>
                <option value="DISPATCH_ORDER">Dispatches</option>
                <option value="CANCEL_SALES_ORDER">Cancellations</option>
                <option value="RECEIVE_RAW_MATERIAL">Raw Material Receipts</option>
                <option value="ADMIN_STOCK_CORRECTION">Admin Corrections</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Entity</th>
                  <th className="px-6 py-3">Entity ID</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length > 0 ? (
                  filtered.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-700">{l.entity}</td>
                      <td className="px-6 py-3.5 text-xs text-slate-600 font-mono">
                        {l.entityId || "—"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            l.userRole === "ADMIN"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          <Shield className="h-3 w-3" />
                          {l.userRole}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600 font-mono max-w-md truncate">
                        {l.detailsJson || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                      No audit events found.
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
