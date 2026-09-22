"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type LeadKind = "family" | "referral" | "career";
type LeadStatus =
  | "NEW"
  | "CONTACT_ATTEMPTED"
  | "CONTACTED"
  | "INSURANCE_VERIFICATION"
  | "DOCUMENTS_NEEDED"
  | "ASSESSMENT_PENDING"
  | "WAITLIST"
  | "SERVICES_STARTED"
  | "NOT_ELIGIBLE_OUTSIDE_AREA"
  | "CLOSED";

// Mirrors prisma/schema.prisma's Lead model as returned by GET
// /api/admin/leads (dates arrive as ISO strings over JSON).
type Lead = {
  id: string;
  kind: LeadKind;
  status: LeadStatus;
  assignedTo: string | null;
  notes: string;
  language: string;
  contactName: string | null;
  clientFirstName: string | null;
  relationship: string | null;
  clientAge: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  zip: string | null;
  county: string | null;
  setting: string | null;
  insurance: string | null;
  previousAba: string | null;
  hasReferral: string | null;
  hasEvaluation: string | null;
  hasIep: string | null;
  contactMethod: string | null;
  contactTime: string | null;
  howHeard: string | null;
  message: string | null;
  organization: string | null;
  role: string | null;
  positionAppliedFor: string | null;
  consentGiven: boolean;
  consentTimestamp: string;
  sourcePage: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACT_ATTEMPTED",
  "CONTACTED",
  "INSURANCE_VERIFICATION",
  "DOCUMENTS_NEEDED",
  "ASSESSMENT_PENDING",
  "WAITLIST",
  "SERVICES_STARTED",
  "NOT_ELIGIBLE_OUTSIDE_AREA",
  "CLOSED",
];

const KIND_LABEL: Record<LeadKind, string> = {
  family: "Family",
  referral: "Referral",
  career: "Career",
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  NEW: "bg-brand-blue-light text-brand-blue",
  CONTACT_ATTEMPTED: "bg-ink-100 text-ink-700",
  CONTACTED: "bg-ink-100 text-ink-700",
  INSURANCE_VERIFICATION: "bg-brand-gold/20 text-ink-900",
  DOCUMENTS_NEEDED: "bg-brand-gold/20 text-ink-900",
  ASSESSMENT_PENDING: "bg-brand-purple/15 text-brand-purple",
  WAITLIST: "bg-brand-orange/15 text-brand-orange",
  SERVICES_STARTED: "bg-brand-green-light text-brand-green",
  NOT_ELIGIBLE_OUTSIDE_AREA: "bg-ink-100 text-ink-500",
  CLOSED: "bg-ink-100 text-ink-500",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function displayName(lead: Lead) {
  return lead.contactName || lead.clientFirstName || lead.email || lead.phone || "(no name)";
}

export default function AdminDashboard({ username }: { username: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [draftAssignee, setDraftAssignee] = useState<Record<string, string>>({});

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (kindFilter) params.set("kind", kindFilter);
      if (q) params.set("q", q);

      const res = await fetch(`/api/admin/leads?${params.toString()}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.status === 503) {
        setLoadError("No database is connected yet — the dashboard needs DATABASE_URL to be set.");
        setLeads([]);
        return;
      }
      if (!res.ok) {
        setLoadError("Couldn't load leads. Please try again.");
        return;
      }
      const data = (await res.json()) as { leads: Lead[] };
      setLeads(data.leads);
    } catch {
      setLoadError("Couldn't load leads. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kindFilter, q, router]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  async function updateLead(id: string, patch: Partial<{ status: LeadStatus; notes: string; assignedTo: string }>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { lead: Lead };
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
    } finally {
      setSavingId(null);
    }
  }

  async function deleteLead(id: string) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) return;
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setExpandedId((cur) => (cur === id ? null : cur));
    } finally {
      setSavingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Lead dashboard</h1>
          <p className="text-sm text-ink-500">Signed in as {username}</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-full border border-ink-100 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
        >
          Sign out
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl3 border border-ink-100 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="filter-kind">
            Kind
          </label>
          <select
            id="filter-kind"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
          >
            <option value="">All</option>
            <option value="family">Family</option>
            <option value="referral">Referral</option>
            <option value="career">Career</option>
          </select>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(qInput.trim());
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="filter-q">
              Search
            </label>
            <input
              id="filter-q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Name, email, phone, city, ZIP…"
              className="w-64 rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
          >
            Search
          </button>
        </form>
        <button
          onClick={() => fetchLeads()}
          className="ml-auto rounded-xl border border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
        >
          Refresh
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-brand-coral/30 bg-brand-coral/10 p-3 text-sm text-brand-coral">
          {loadError}
        </div>
      )}

      {loading && !loadError && <p className="text-sm text-ink-500">Loading…</p>}

      {!loading && !loadError && leads.length === 0 && (
        <p className="text-sm text-ink-500">No leads match these filters.</p>
      )}

      {!loading && leads.length > 0 && (
        <div className="overflow-hidden rounded-xl3 border border-ink-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-100/50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <FragmentRow
                  key={lead.id}
                  lead={lead}
                  expanded={expandedId === lead.id}
                  saving={savingId === lead.id}
                  confirmingDelete={confirmDeleteId === lead.id}
                  notesDraft={draftNotes[lead.id] ?? lead.notes}
                  assigneeDraft={draftAssignee[lead.id] ?? lead.assignedTo ?? ""}
                  onToggle={() => setExpandedId((cur) => (cur === lead.id ? null : lead.id))}
                  onStatusChange={(status) => updateLead(lead.id, { status })}
                  onNotesChange={(notes) => setDraftNotes((d) => ({ ...d, [lead.id]: notes }))}
                  onAssigneeChange={(assignedTo) =>
                    setDraftAssignee((d) => ({ ...d, [lead.id]: assignedTo }))
                  }
                  onSaveDetails={() =>
                    updateLead(lead.id, {
                      notes: draftNotes[lead.id] ?? lead.notes,
                      assignedTo: draftAssignee[lead.id] ?? lead.assignedTo ?? "",
                    })
                  }
                  onDeleteClick={() => setConfirmDeleteId(lead.id)}
                  onDeleteCancel={() => setConfirmDeleteId(null)}
                  onDeleteConfirm={() => deleteLead(lead.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  lead,
  expanded,
  saving,
  confirmingDelete,
  notesDraft,
  assigneeDraft,
  onToggle,
  onStatusChange,
  onNotesChange,
  onAssigneeChange,
  onSaveDetails,
  onDeleteClick,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  lead: Lead;
  expanded: boolean;
  saving: boolean;
  confirmingDelete: boolean;
  notesDraft: string;
  assigneeDraft: string;
  onToggle: () => void;
  onStatusChange: (status: LeadStatus) => void;
  onNotesChange: (notes: string) => void;
  onAssigneeChange: (assignedTo: string) => void;
  onSaveDetails: () => void;
  onDeleteClick: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  const detailFields: [string, string | null][] = [
    ["Relationship", lead.relationship],
    ["Client first name", lead.clientFirstName],
    ["Client age/group", lead.clientAge],
    ["County", lead.county],
    ["Preferred setting", lead.setting],
    ["Insurance", lead.insurance],
    ["Previous ABA", lead.previousAba],
    ["Referral available", lead.hasReferral],
    ["Diagnostic evaluation available", lead.hasEvaluation],
    ["IEP/504 available", lead.hasIep],
    ["Preferred contact method", lead.contactMethod],
    ["Preferred contact time", lead.contactTime],
    ["How they heard about us", lead.howHeard],
    ["Organization", lead.organization],
    ["Role", lead.role],
    ["Position applied for", lead.positionAppliedFor],
    ["Language", lead.language],
    ["Source page", lead.sourcePage],
    ["Referrer", lead.referrer],
    ["UTM source", lead.utmSource],
    ["UTM campaign", lead.utmCampaign],
  ];

  return (
    <>
      <tr className="border-b border-ink-100 last:border-0 hover:bg-ink-100/30">
        <td className="whitespace-nowrap px-4 py-3 text-ink-500">{formatDate(lead.createdAt)}</td>
        <td className="whitespace-nowrap px-4 py-3">
          <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700">
            {KIND_LABEL[lead.kind]}
          </span>
        </td>
        <td className="px-4 py-3 font-medium text-ink-900">{displayName(lead)}</td>
        <td className="px-4 py-3 text-ink-700">
          <div>{lead.phone || "—"}</div>
          <div className="text-xs text-ink-500">{lead.email || ""}</div>
        </td>
        <td className="px-4 py-3 text-ink-700">
          {[lead.city, lead.zip].filter(Boolean).join(", ") || "—"}
        </td>
        <td className="px-4 py-3">
          <select
            value={lead.status}
            disabled={saving}
            onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
            className={cn(
              "rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none disabled:opacity-60",
              STATUS_STYLE[lead.status]
            )}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={onToggle}
            className="text-xs font-medium text-brand-blue hover:underline"
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-ink-100 bg-ink-100/20 last:border-0">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {detailFields
                .filter(([, v]) => v !== null && v !== "")
                .map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs font-medium text-ink-500">{label}</div>
                    <div className="text-sm text-ink-900">{value}</div>
                  </div>
                ))}
              <div>
                <div className="text-xs font-medium text-ink-500">Consent</div>
                <div className="text-sm text-ink-900">
                  {lead.consentGiven ? "Given" : "Not given"} · {formatDate(lead.consentTimestamp)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-ink-500">Lead ID</div>
                <div className="text-sm text-ink-900">{lead.id}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-ink-500">Last updated</div>
                <div className="text-sm text-ink-900">{formatDate(lead.updatedAt)}</div>
              </div>
            </div>

            {lead.message && (
              <div className="mt-4">
                <div className="text-xs font-medium text-ink-500">Message</div>
                <p className="whitespace-pre-wrap text-sm text-ink-900">{lead.message}</p>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,220px]">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor={`notes-${lead.id}`}>
                  Notes (internal)
                </label>
                <textarea
                  id={`notes-${lead.id}`}
                  rows={2}
                  value={notesDraft}
                  onChange={(e) => onNotesChange(e.target.value)}
                  className="w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor={`assignee-${lead.id}`}>
                  Assigned to
                </label>
                <input
                  id={`assignee-${lead.id}`}
                  value={assigneeDraft}
                  onChange={(e) => onAssigneeChange(e.target.value)}
                  className="w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={onSaveDetails}
                disabled={saving}
                className="rounded-full bg-brand-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save notes & assignee"}
              </button>

              {confirmingDelete ? (
                <>
                  <span className="text-xs text-ink-500">Delete this lead permanently?</span>
                  <button
                    onClick={onDeleteConfirm}
                    disabled={saving}
                    className="rounded-full bg-brand-coral px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    onClick={onDeleteCancel}
                    disabled={saving}
                    className="text-xs font-medium text-ink-500 hover:underline"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={onDeleteClick}
                  disabled={saving}
                  className="rounded-full border border-brand-coral px-4 py-2 text-xs font-semibold text-brand-coral hover:bg-brand-coral/10 disabled:opacity-60"
                >
                  Delete lead
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
