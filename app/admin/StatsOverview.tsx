"use client";

import { useMemo } from "react";
import BarChart from "@/components/admin/charts/BarChart";
import DonutChart from "@/components/admin/charts/DonutChart";
import TrendChart from "@/components/admin/charts/TrendChart";
import {
  KIND_COLOR,
  KIND_LABEL,
  STATUS_COLOR,
  STATUSES,
  type Lead,
} from "./AdminDashboard";

const TREND_DAYS = 14;

function statusLabel(s: string) {
  // "NOT_ELIGIBLE_OUTSIDE_AREA" -> "Not eligible / outside area" would be
  // nicer, but "Not eligible outside area" (title case, no underscores) is
  // close enough and matches how the rest of the dashboard already
  // displays statuses — replaceAll("_", " ") is the existing convention.
  return s.replaceAll("_", " ");
}

export default function StatsOverview({
  leads,
  loading,
  loadError,
}: {
  leads: Lead[];
  loading: boolean;
  loadError: string | null;
}) {
  const stats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const byKind: Record<string, number> = { family: 0, referral: 0, career: 0 };
    const byStatus: Record<string, number> = {};
    for (const s of STATUSES) byStatus[s] = 0;

    let newThisWeek = 0;
    let startedServices = 0;
    let needsAttention = 0;

    for (const lead of leads) {
      byKind[lead.kind] = (byKind[lead.kind] ?? 0) + 1;
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
      if (new Date(lead.createdAt).getTime() >= sevenDaysAgo) newThisWeek++;
      if (lead.status === "SERVICES_STARTED") startedServices++;
      if (lead.status === "NEW" || lead.status === "CONTACT_ATTEMPTED") needsAttention++;
    }

    // Daily counts for the last TREND_DAYS days (oldest first), bucketed
    // by local calendar day on createdAt.
    const dayBuckets = new Map<string, number>();
    const dayKeys: string[] = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayKeys.push(key);
      dayBuckets.set(key, 0);
    }
    for (const lead of leads) {
      const key = new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    }

    return {
      total: leads.length,
      newThisWeek,
      startedServices,
      needsAttention,
      byKind,
      byStatus,
      trend: dayKeys.map((key) => ({ label: key, value: dayBuckets.get(key) ?? 0 })),
    };
  }, [leads]);

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;
  if (loadError) {
    return (
      <div className="rounded-xl border border-brand-coral/30 bg-brand-coral/10 p-3 text-sm text-brand-coral">
        {loadError}
      </div>
    );
  }

  const kpis = [
    { label: "Total leads", value: stats.total, color: "text-brand-blue" },
    { label: "New this week", value: stats.newThisWeek, color: "text-brand-green" },
    { label: "Needs attention", value: stats.needsAttention, color: "text-brand-orange" },
    { label: "Started services", value: stats.startedServices, color: "text-brand-purple" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl3 border border-ink-100 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-soft"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-ink-500">{kpi.label}</div>
            <div className={`mt-1.5 font-display text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl3 border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Leads, last {TREND_DAYS} days</h2>
          <div className="mt-4">
            <TrendChart data={stats.trend} />
          </div>
        </div>

        <div className="rounded-xl3 border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">By kind</h2>
          <div className="mt-4">
            <DonutChart
              segments={(["family", "referral", "career"] as const).map((k) => ({
                label: KIND_LABEL[k],
                value: stats.byKind[k] ?? 0,
                color: KIND_COLOR[k],
              }))}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl3 border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="text-sm font-semibold text-ink-900">By status</h2>
        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[640px]">
            <BarChart
              data={STATUSES.map((s) => ({
                label: statusLabel(s),
                value: stats.byStatus[s] ?? 0,
                color: STATUS_COLOR[s],
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
