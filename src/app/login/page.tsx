"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Shield, UserCheck, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const setCredentials = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-2xl shadow-lg shadow-blue-500/20 mb-4">
            TF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tape Factory Stock System
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manufacturing Execution & Inventory Management
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-medium">Authentication Failed</p>
                <p className="mt-0.5 text-xs text-rose-600">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@tape.local"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Assessment Credentials */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 text-center">
              Assessment Demo Accounts (Click to Autofill)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCredentials("admin@tape.local", "AdminDemo@2026")}
                className="flex flex-col items-start rounded-lg border border-purple-200 bg-purple-50/70 p-3 text-left hover:bg-purple-100/70 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800">
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </div>
                <span className="text-[11px] text-purple-600 mt-0.5 truncate w-full">
                  admin@tape.local
                </span>
                <span className="text-[10px] text-slate-500">Full Permissions</span>
              </button>

              <button
                type="button"
                onClick={() => setCredentials("staff@tape.local", "StaffDemo@2026")}
                className="flex flex-col items-start rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-left hover:bg-blue-100/70 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                  <UserCheck className="h-3.5 w-3.5" />
                  Staff
                </div>
                <span className="text-[11px] text-blue-600 mt-0.5 truncate w-full">
                  staff@tape.local
                </span>
                <span className="text-[10px] text-slate-500">Floor Operations</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Tape Factory Stock Management System &bull; Confidential Assessment Build
        </p>
      </div>
    </div>
  );
}
