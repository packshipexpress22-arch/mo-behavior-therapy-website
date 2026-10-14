"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

// Mirrors lib/phiDocuments.ts's PhiDocument type (server-only module, so
// re-declared here for the client bundle rather than imported).
type DocumentType =
  | "caregiver_id"
  | "insurance_card"
  | "diagnosis_letter"
  | "iep"
  | "psych_evaluation"
  | "other";
type DocumentStatus = "pending_upload" | "uploaded";
type PhiDocument = {
  patientId: string;
  documentId: string;
  fileName: string;
  contentType: string;
  documentType: DocumentType;
  status: DocumentStatus;
  sizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
};

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  caregiver_id: "Caregiver photo ID",
  insurance_card: "Client's insurance card",
  diagnosis_letter: "Diagnosis letter (pediatrician, neurologist, or psychiatrist)",
  iep: "IEP (Individualized Education Program)",
  psych_evaluation: "Psychological evaluation",
  other: "Other",
};

// What a caregiver is asked to gather before starting. The first two are
// needed for every case; the rest only apply if the family already has
// them (a lead may not have an IEP or a prior psych evaluation yet).
const DOCUMENT_CHECKLIST: { type: DocumentType; required: boolean }[] = [
  { type: "caregiver_id", required: true },
  { type: "insurance_card", required: true },
  { type: "diagnosis_letter", required: false },
  { type: "iep", required: false },
  { type: "psych_evaluation", required: false },
];

/** Old rows written under a retired category (see lib/phiDocuments.ts's
 * history note) won't have a label above — fall back to "Other" instead of
 * rendering "undefined". */
function labelFor(type: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[type] ?? DOCUMENT_TYPE_LABELS.other;
}

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.heic,.webp";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalDashboard({ email }: { email: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<PhiDocument[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [documentType, setDocumentType] = useState<DocumentType>("caregiver_id");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/portal/documents");
      if (res.status === 401) {
        router.push("/portal/login");
        return;
      }
      const body = await res.json();
      setDocuments(body.documents ?? []);
    } finally {
      setLoadingList(false);
    }
  }, [router]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      // 1. Ask our server for a presigned S3 URL (creates the metadata row
      //    as "pending_upload" first).
      const createRes = await fetch("/api/portal/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          documentType,
        }),
      });
      if (createRes.status === 401) {
        router.push("/portal/login");
        return;
      }
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error === "unsupported_file_type" ? "unsupported_file_type" : "create_failed");
      }
      const { documentId, uploadUrl } = await createRes.json();

      // 2. Upload the file bytes directly to S3 from the browser — this
      //    never passes through our server or through Claude.
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error("upload_failed");

      // 3. Tell our server the upload finished, so it can verify the object
      //    exists in S3 and flip the metadata row to "uploaded".
      const confirmRes = await fetch(`/api/portal/documents/${documentId}/confirm`, {
        method: "POST",
      });
      if (!confirmRes.ok) throw new Error("confirm_failed");

      await loadDocuments();
    } catch (err) {
      const code = err instanceof Error ? err.message : "unknown";
      setError(
        code === "unsupported_file_type"
          ? "That file type isn't supported. Please upload a PDF, JPG, PNG, HEIC, or WEBP file."
          : "Something went wrong uploading that file. Please try again."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Patient portal</h1>
          <p className="text-sm text-ink-500">Signed in as {email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-full border border-ink-100 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Sign out
        </button>
      </div>

      <section className="mb-8 rounded-xl3 border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="mb-1 text-sm font-semibold text-ink-900">Documents you'll need</h2>
        <p className="mb-3 text-sm text-ink-500">
          Please upload the following. The first two are required for every case; the rest only if
          you already have them.
        </p>
        <ul className="mb-2 space-y-1 text-sm text-ink-700">
          {DOCUMENT_CHECKLIST.map(({ type, required }) => {
            const uploaded = documents.some((d) => d.documentType === type && d.status === "uploaded");
            return (
              <li key={type} className="flex items-start gap-2">
                <span
                  className={
                    uploaded
                      ? "mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-brand-green text-[10px] font-bold text-white"
                      : "mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border border-ink-100"
                  }
                  aria-hidden="true"
                >
                  {uploaded ? "✓" : ""}
                </span>
                <span>
                  {DOCUMENT_TYPE_LABELS[type]}
                  {!required && <span className="text-ink-500"> (if you have one)</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-8 rounded-xl3 border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="mb-1 text-sm font-semibold text-ink-900">Upload a document</h2>
        <p className="mb-4 text-sm text-ink-500">
          PDF, JPG, PNG, HEIC, or WEBP. Your file is uploaded directly and securely, encrypted in
          storage — it is never shared outside MO Behavior Therapy's HIPAA-compliant storage, and it
          is never processed by any AI tool.
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="documentType">
            Document type
          </label>
          <select
            id="documentType"
            className="w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 text-sm outline-none focus-visible:border-brand-blue"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          >
            {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((key) => (
              <option key={key} value={key}>
                {DOCUMENT_TYPE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-4 text-sm text-brand-coral">{error}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileSelected}
          disabled={uploading}
          className="block w-full text-sm text-ink-700 file:mr-4 file:rounded-full file:border-0 file:bg-brand-blue file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:opacity-90 disabled:opacity-60"
        />
        {uploading && <p className="mt-3 text-sm text-ink-500">Uploading…</p>}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Your documents</h2>
        {loadingList ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-ink-500">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.documentId}
                className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-4 shadow-card"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{doc.fileName}</p>
                  <p className="text-xs text-ink-500">
                    {labelFor(doc.documentType)} · {new Date(doc.createdAt).toLocaleDateString()}
                    {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
                  </p>
                </div>
                <span
                  className={
                    doc.status === "uploaded"
                      ? "rounded-full bg-brand-green-light px-3 py-1 text-xs font-medium text-brand-green"
                      : "rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-500"
                  }
                >
                  {doc.status === "uploaded" ? "Uploaded" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
