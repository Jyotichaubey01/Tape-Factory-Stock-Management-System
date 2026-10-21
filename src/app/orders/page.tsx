"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  ShoppingCart,
  Plus,
  Truck,
  Ban,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  ArrowRight,
} from "lucide-react";
import { parseOrderQuantity } from "@/lib/bom";

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface Specification {
  id: string;
  code: string;
  widthMm: number;
  filmGsm: number;
  dryCoatingGsm: number;
  adhesiveSolidsPercent: number;
  rollLengthM: number;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  orderedUnit: "ROLLS" | "METRES" | "NET_KG";
  originalInputQuantity: number;
  orderedRolls: number;
  reservedRolls: number;
  dispatchedRolls: number;
  cancelledRolls: number;
  status: "CONFIRMED" | "PARTIALLY_DISPATCHED" | "FULFILLED" | "CANCELLED";
  notes?: string;
  createdAt: string;
  customer: {
    name: string;
    code: string;
  };
  specification: {
    code: string;
    rollLengthM: number;
  };
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [loading, setLoading] = useState(true);

  // New Order Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [specificationId, setSpecificationId] = useState("");
  const [unit, setUnit] = useState<"ROLLS" | "METRES" | "NET_KG">("ROLLS");
  const [quantity, setQuantity] = useState(5);
  const [orderNotes, setOrderNotes] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<any>(null);

  // Dispatch Modal state
  const [dispatchOrderObj, setDispatchOrderObj] = useState<SalesOrder | null>(null);
  const [dispatchRolls, setDispatchRolls] = useState(1);
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Cancel Modal state
  const [cancelOrderObj, setCancelOrderObj] = useState<SalesOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(
    null
  );

  const fetchData = async () => {
    try {
      const [resOrders, resCust, resSpecs] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/customers"),
        fetch("/api/specifications"),
      ]);

      const dataOrders = await resOrders.json();
      const dataCust = await resCust.json();
      const dataSpecs = await resSpecs.json();

      if (dataOrders.orders) setOrders(dataOrders.orders);
      if (dataCust.customers) {
        setCustomers(dataCust.customers);
        if (!customerId && dataCust.customers.length > 0) {
          setCustomerId(dataCust.customers[0].id);
        }
      }
      if (dataSpecs.specifications) {
        setSpecs(dataSpecs.specifications);
        if (!specificationId && dataSpecs.specifications.length > 0) {
          setSpecificationId(dataSpecs.specifications[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedSpec = specs.find((s) => s.id === specificationId);

  // Live order validation check in client
  let liveValidation = null;
  if (selectedSpec && quantity > 0) {
    try {
      liveValidation = parseOrderQuantity(unit, quantity, {
        widthMm: selectedSpec.widthMm,
        filmGsm: selectedSpec.filmGsm,
        dryCoatingGsm: selectedSpec.dryCoatingGsm,
        adhesiveSolidsPercent: selectedSpec.adhesiveSolidsPercent,
        rollLengthM: selectedSpec.rollLengthM,
      });
    } catch (e) {
      liveValidation = null;
    }
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOrder(true);
    setOrderError(null);

    const idempotencyKey = `order-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          customerId,
          specificationId,
          unit,
          quantity,
          notes: orderNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.details || { message: data.error });
        throw new Error(data.error || "Failed to create order");
      }

      setShowCreateModal(false);
      setNotification({
        type: "success",
        msg: `Order ${data.order.orderNumber} placed and ${data.order.orderedRolls} rolls reserved atomically!`,
      });
      fetchData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchOrderObj) return;
    setSubmittingDispatch(true);
    setDispatchError(null);

    const idempotencyKey = `dsp-${dispatchOrderObj.id}-${Date.now()}`;

    try {
      const res = await fetch(`/api/orders/${dispatchOrderObj.id}/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          rollCount: dispatchRolls,
          notes: dispatchNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dispatch failed");

      setDispatchOrderObj(null);
      setNotification({
        type: "success",
        msg: `Dispatched ${dispatchRolls} rolls under ${data.dispatch.dispatchNumber}!`,
      });
      fetchData();
    } catch (err: any) {
      setDispatchError(err.message);
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelOrderObj) return;
    setSubmittingCancel(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/orders/${cancelOrderObj.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancellation failed");

      setCancelOrderObj(null);
      setNotification({
        type: "success",
        msg: `Cancelled unshipped balance of ${data.cancellation.releasedRolls} rolls and released reservation back to inventory!`,
      });
      fetchData();
    } catch (err: any) {
      setCancelError(err.message);
    } finally {
      setSubmittingCancel(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Sales Orders & Stock Reservations
            </h1>
            <p className="text-sm text-slate-600">
              Orders accept Rolls, Metres, or Net Tape KG. Atomic reservation guarantees stock availability without overselling.
            </p>
          </div>
          <button
            onClick={() => {
              setOrderError(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Sales Order
          </button>
        </div>

        {notification && (
          <div
            className={`rounded-xl border p-4 text-sm flex items-start gap-3 ${
              notification.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 flex justify-between">
              <div>
                <p className="font-semibold">
                  {notification.type === "success" ? "Success" : "Error"}
                </p>
                <p className="text-xs mt-0.5">{notification.msg}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-xs font-bold hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <h2 className="font-semibold text-slate-900">Sales Orders Register</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Order Number</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Specification</th>
                  <th className="px-6 py-3">Original Input</th>
                  <th className="px-6 py-3">Rolls Status</th>
                  <th className="px-6 py-3">Order Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length > 0 ? (
                  orders.map((o) => {
                    const unshipped = o.orderedRolls - o.dispatchedRolls - o.cancelledRolls;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-semibold text-slate-900">{o.orderNumber}</td>
                        <td className="px-6 py-4 text-slate-700">{o.customer?.name}</td>
                        <td className="px-6 py-4 text-slate-700">{o.specification?.code}</td>
                        <td className="px-6 py-4 text-slate-600 text-xs">
                          {o.originalInputQuantity} {o.orderedUnit} &rarr; {o.orderedRolls} Rolls
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-900">
                              {o.dispatchedRolls} of {o.orderedRolls} Shipped
                            </span>
                            {o.reservedRolls > 0 && (
                              <span className="block text-amber-600 font-medium">
                                ({o.reservedRolls} reserved)
                              </span>
                            )}
                            {o.cancelledRolls > 0 && (
                              <span className="block text-rose-600">
                                ({o.cancelledRolls} cancelled)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                              o.status === "FULFILLED"
                                ? "bg-emerald-100 text-emerald-800"
                                : o.status === "CANCELLED"
                                ? "bg-rose-100 text-rose-800"
                                : o.status === "PARTIALLY_DISPATCHED"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {unshipped > 0 && (
                            <>
                              <button
                                onClick={() => {
                                  setDispatchOrderObj(o);
                                  setDispatchRolls(unshipped);
                                  setDispatchNotes("");
                                  setDispatchError(null);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                              >
                                <Truck className="h-3 w-3" />
                                Dispatch
                              </button>
                              <button
                                onClick={() => {
                                  setCancelOrderObj(o);
                                  setCancelReason("");
                                  setCancelError(null);
                                }}
                                className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                <Ban className="h-3 w-3" />
                                Cancel
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                      No sales orders recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Order Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  Create Customer Sales Order
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {orderError && (
                <div className="mt-4 rounded-lg bg-rose-50 p-4 text-xs text-rose-800 border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    <span>{orderError.message || "Invalid Order Quantity"}</span>
                  </div>
                  {orderError.suggestedAlternatives &&
                    orderError.suggestedAlternatives.length > 0 && (
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">
                          Valid Whole-Roll Alternatives (Click to apply):
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {orderError.suggestedAlternatives.map((alt: any) => (
                            <button
                              key={alt.rolls}
                              type="button"
                              onClick={() => {
                                if (unit === "ROLLS") setQuantity(alt.rolls);
                                else if (unit === "METRES") setQuantity(alt.metres);
                                else setQuantity(parseFloat(alt.netKg));
                                setOrderError(null);
                              }}
                              className="rounded border border-rose-300 bg-white p-2 text-left hover:bg-rose-100/60"
                            >
                              <span className="block font-bold text-slate-900">
                                {alt.rolls} Rolls
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {alt.metres} m &bull; {alt.netKg} kg
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              <form onSubmit={handleCreateOrder} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Customer Account
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Tape Specification
                  </label>
                  <select
                    value={specificationId}
                    onChange={(e) => setSpecificationId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {specs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} ({s.widthMm}mm, {s.filmGsm} GSM, {s.rollLengthM}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <span className="text-xs font-bold uppercase text-slate-700 block">
                    Order Quantity Entry Unit
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    {(["ROLLS", "METRES", "NET_KG"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          setUnit(u);
                          if (u === "ROLLS") setQuantity(5);
                          if (u === "METRES") setQuantity(5000);
                          if (u === "NET_KG") setQuantity(11.28);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                          unit === u
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {u === "ROLLS" ? "Whole Rolls" : u === "METRES" ? "Metres" : "Net Tape Kg"}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Input Value in {unit}
                    </label>
                    <input
                      type="number"
                      step={unit === "ROLLS" ? "1" : "0.001"}
                      min="0.001"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-base font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  {liveValidation && (
                    <div
                      className={`rounded-lg p-2.5 text-xs ${
                        liveValidation.isValid
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {liveValidation.isValid ? (
                        <span className="font-semibold">
                          Valid! Equivalent to exactly {liveValidation.orderedRolls} whole rolls.
                        </span>
                      ) : (
                        <span>{liveValidation.error}</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Order Delivery Notes / PO Reference
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="e.g. Expedited truck dispatch required for warehouse 4"
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  />
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
                    disabled={submittingOrder || (liveValidation ? !liveValidation.isValid : false)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submittingOrder ? "Reserving..." : "Confirm & Reserve Stock"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dispatch Modal */}
        {dispatchOrderObj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Dispatch Order: {dispatchOrderObj.orderNumber}
                </h3>
                <button
                  onClick={() => setDispatchOrderObj(null)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {dispatchError && (
                <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  {dispatchError}
                </div>
              )}

              <form onSubmit={handleDispatch} className="mt-4 space-y-4">
                <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                  <p>
                    <span className="font-semibold text-slate-700">Customer:</span>{" "}
                    {dispatchOrderObj.customer?.name}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Total Ordered:</span>{" "}
                    {dispatchOrderObj.orderedRolls} rolls
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Already Dispatched:</span>{" "}
                    {dispatchOrderObj.dispatchedRolls} rolls
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-700">Unshipped Balance:</span>{" "}
                    {dispatchOrderObj.orderedRolls -
                      dispatchOrderObj.dispatchedRolls -
                      dispatchOrderObj.cancelledRolls}{" "}
                    rolls
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Rolls to Dispatch (Partial or Full)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={
                      dispatchOrderObj.orderedRolls -
                      dispatchOrderObj.dispatchedRolls -
                      dispatchOrderObj.cancelledRolls
                    }
                    step="1"
                    required
                    value={dispatchRolls}
                    onChange={(e) => setDispatchRolls(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Dispatch Delivery Notes / Gate Pass
                  </label>
                  <input
                    type="text"
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="e.g. Loaded onto vehicle KA-04-E-4421"
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDispatchOrderObj(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDispatch}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submittingDispatch ? "Processing..." : "Confirm Dispatch"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {cancelOrderObj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 text-rose-600">
                  <Ban className="h-5 w-5" />
                  Cancel Unshipped Order Balance
                </h3>
                <button
                  onClick={() => setCancelOrderObj(null)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {cancelError && (
                <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  {cancelError}
                </div>
              )}

              <form onSubmit={handleCancel} className="mt-4 space-y-4">
                <div className="rounded-lg bg-rose-50/70 p-3 text-xs text-rose-900 space-y-1">
                  <p>
                    <span className="font-semibold">Order:</span> {cancelOrderObj.orderNumber}
                  </p>
                  <p>
                    <span className="font-semibold">Unshipped Rolls to Release:</span>{" "}
                    {cancelOrderObj.orderedRolls -
                      cancelOrderObj.dispatchedRolls -
                      cancelOrderObj.cancelledRolls}{" "}
                    rolls
                  </p>
                  <p className="text-[11px] text-rose-700 mt-1">
                    Cancelling releases reserved finished goods back to available warehouse stock.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Mandatory Cancellation Reason (Min 5 chars)
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Customer cancelled purchase order due to project postponement."
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCancelOrderObj(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCancel || cancelReason.trim().length < 5}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {submittingCancel ? "Cancelling..." : "Confirm Cancellation"}
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
