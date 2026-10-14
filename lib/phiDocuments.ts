import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    QueryCommand,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { deleteObject } from "./phiStorage";

// PHI document metadata - DynamoDB only, never the file bytes themselves
// (those live in S3, see lib/phiStorage.ts). This module never receives or
// handles the actual file content, so it is safe to run in the same Lambda
// as everything else without ever putting a real document through Claude.
//
// Table: created manually in Paso 3 (mo-behavior-therapy-phi-documents),
// NOT provisioned by SST - referenced here via the PHI_TABLE env var, which
// sst.config.ts sets from an sst.Linkable wrapping the existing table's
// name/ARN (see the "PhiDocuments" Linkable there). Partition key
// `patientId` (the patient's normalized email - see lib/phiAuth.ts), sort
// key `documentId` (nanoid, generated per upload).

const TABLE_NAME = process.env.PHI_TABLE;

export function phiDocumentsConfigured(): boolean {
    return Boolean(TABLE_NAME);
}

const client = TABLE_NAME
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
          marshallOptions: { removeUndefinedValues: true },
  })
    : null;

// Updated 2026-10-01 to the specific intake checklist the practice actually
// needs per case (see the email invite sent from lib/email.ts's
// sendDocumentUploadInvite()): a caregiver photo ID, the client's insurance
// card, and - when the family has them - a diagnosing provider's letter,
// an IEP, and a psychological evaluation. "other" is kept as a catch-all for
// anything that doesn't fit (e.g. a legal/consent form a family uploads
// unprompted). The previous generic categories (medical_evaluation,
// legal_consent) are intentionally retired - existing rows already written
// with those values still read back fine (DynamoDB has no schema to
// migrate), they just render under whichever label app/portal/PortalDashboard.tsx
// falls back to for an unrecognized type.
export type DocumentType =
    | "caregiver_id"
  | "insurance_card"
  | "diagnosis_letter"
  | "iep"
  | "psych_evaluation"
  | "other";
export type DocumentStatus = "pending_upload" | "uploaded";

export type PhiDocument = {
    patientId: string;
    documentId: string;
    // Added 2026-10-12 — which lead/referral this document belongs to (see
    // lib/phiAuth.ts's same-dated update note). Nullable because the
    // DynamoDB table's physical key is still just (patientId, documentId) —
    // this is an added attribute, not a key change — and because documents
    // written before this fix carry no leadId at all. listDocumentsForPatient()
    // filters on it so one email reused across multiple cases (a provider
    // referring several different children, or a parent referring two kids)
    // never mixes those cases' documents together again.
    leadId: string | null;
    fileName: string;
    contentType: string;
    documentType: DocumentType;
    s3Key: string;
    status: DocumentStatus;
    sizeBytes: number | null;
    createdAt: string;
    updatedAt: string;
    // Added 2026-10-14 — document trash/restore feature. Set to an ISO
    // timestamp when a family or admin removes a document they uploaded by
    // mistake; the document is hidden from the normal list but kept (and
    // its S3 object kept) for TRASH_RETENTION_DAYS so it can be restored.
    // `null`/absent means "not in the trash" — existing rows written before
    // this feature read back fine as `undefined`, which the filters below
    // treat the same as `null`. See softDeleteDocument/restoreDocument and
    // the sweepExpired() purge below.
    deletedAt?: string | null;
};

// How long a soft-deleted document stays recoverable before it's purged
// for good (DynamoDB row + S3 object). Chosen at the user's request
// ("se borre a los 30 dias" if not restored from the trash).
export const TRASH_RETENTION_DAYS = 30;

function isExpired(doc: PhiDocument): boolean {
    if (!doc.deletedAt) return false;
    const ageMs = Date.now() - new Date(doc.deletedAt).getTime();
    return ageMs > TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Lazy purge sweep: given a list of already-trashed documents, hard-deletes
 * (S3 object + DynamoDB row) any that have passed TRASH_RETENTION_DAYS and
 * returns only the ones still within their retention window.
 *
 * This table was created manually (see the header comment above) rather
 * than provisioned by SST, so it can't get a real DynamoDB `ttl` attribute
 * the way lib/securityStore.ts's SecurityTable does — and even DynamoDB TTL
 * alone would only ever delete the DynamoDB row, never the paired S3
 * object. So instead of a background timer, the purge happens inline,
 * on-demand, whenever a trash view is actually loaded (family or admin —
 * see listTrashedDocumentsForPatient/listAllTrashedDocuments below). A
 * document that nobody ever looks at in the trash stays safely stored
 * past 30 days rather than disappearing on a schedule nothing is driving;
 * in practice the admin dashboard's trash tab is enough to keep this
 * current. Best-effort: a failed purge is logged and the document is just
 * left in the trash list rather than failing the caller's request.
 */
async function sweepExpired(trashed: PhiDocument[]): Promise<PhiDocument[]> {
    const toExpire = trashed.filter(isExpired);
    const kept = trashed.filter((d) => !isExpired(d));
    await Promise.all(
        toExpire.map(async (doc) => {
            try {
                await deleteObject(doc.s3Key);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[phiDocuments] purge: failed to delete S3 object for ${doc.documentId}:`, err);
            }
            try {
                await hardDeleteDocument(doc.patientId, doc.documentId);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[phiDocuments] purge: failed to delete row for ${doc.documentId}:`, err);
            }
        })
    );
    return kept;
}

function requireClient() {
    if (!client || !TABLE_NAME) {
          throw new Error("phiDocuments: PHI_TABLE is not configured");
    }
    return client;
}

export async function putDocument(doc: PhiDocument): Promise<void> {
    const c = requireClient();
    await c.send(new PutCommand({ TableName: TABLE_NAME, Item: doc }));
}

export async function getDocument(patientId: string, documentId: string): Promise<PhiDocument | null> {
    const c = requireClient();
    const res = await c.send(
          new GetCommand({ TableName: TABLE_NAME, Key: { patientId, documentId } })
        );
    return (res.Item as PhiDocument) ?? null;
}

/**
 * `leadId` scopes the result to one case, matching the session that
 * requested it (see app/api/portal/documents/route.ts). When `leadId` is a
 * string, only documents written with that same leadId are returned — a
 * document from a different case under the same email, or a legacy
 * document written before leadId existed (leadId === undefined on the
 * stored item), is correctly excluded rather than silently shown.
 * `leadId === null` (no case could be determined for this session — see
 * lib/phiAuth.ts) deliberately returns nothing rather than falling back to
 * "every document under this email", which is the exact cross-case mixing
 * this filtering exists to prevent.
 */
export async function listDocumentsForPatient(
    patientId: string,
    leadId: string | null
): Promise<PhiDocument[]> {
    const c = requireClient();
    const res = await c.send(
          new QueryCommand({
                  TableName: TABLE_NAME,
                  KeyConditionExpression: "patientId = :pid",
                  ExpressionAttributeValues: { ":pid": patientId },
                  ScanIndexForward: false,
          })
        );
    let items = (res.Items as PhiDocument[]) ?? [];
    items = leadId === null ? [] : items.filter((d) => d.leadId === leadId && !d.deletedAt);
    // documentId (nanoid) isn't chronologically sortable, so sort explicitly.
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Admin-only: lists every uploaded document across all patients, for the
 * admin dashboard's "Documents" tab (see app/api/admin/documents/route.ts).
 * A full table Scan is acceptable here - this table only ever holds one
 * small clinic's document metadata (never the file bytes), the route that
 * calls this is session-gated behind admin auth, and result volume is tiny.
 * Revisit with a GSI (e.g. on status/createdAt) if this table grows large.
 */
export async function listAllDocuments(): Promise<PhiDocument[]> {
    const c = requireClient();
    const items: PhiDocument[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
          const res = await c.send(
                  new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey })
                );
          items.push(...((res.Items as PhiDocument[]) ?? []));
          ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);

  return items
      .filter((d) => d.status === "uploaded" && !d.deletedAt)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Admin-only: every TRASHED document across all patients, for the admin
 * dashboard's "Trash" view — mirrors listAllDocuments()'s full-table Scan
 * (same tiny-table/low-volume justification applies). Sweeps (purges)
 * anything past its 30-day retention window before returning.
 */
export async function listAllTrashedDocuments(): Promise<PhiDocument[]> {
    const c = requireClient();
    const items: PhiDocument[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
          const res = await c.send(
                  new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey })
                );
          items.push(...((res.Items as PhiDocument[]) ?? []));
          ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);

  const trashed = items.filter((d) => d.status === "uploaded" && Boolean(d.deletedAt));
  const kept = await sweepExpired(trashed);
  return kept.sort((a, b) => ((a.deletedAt ?? "") < (b.deletedAt ?? "") ? 1 : -1));
}

export async function markDocumentUploaded(
    patientId: string,
    documentId: string,
    sizeBytes: number
  ): Promise<PhiDocument> {
    const c = requireClient();
    const res = await c.send(
          new UpdateCommand({
                  TableName: TABLE_NAME,
                  Key: { patientId, documentId },
                  UpdateExpression: "SET #status = :status, sizeBytes = :sizeBytes, updatedAt = :updatedAt",
                  ConditionExpression: "attribute_exists(patientId)",
                  ExpressionAttributeNames: { "#status": "status" },
                  ExpressionAttributeValues: {
                            ":status": "uploaded" satisfies DocumentStatus,
                            ":sizeBytes": sizeBytes,
                            ":updatedAt": new Date().toISOString(),
                  },
                  ReturnValues: "ALL_NEW",
          })
        );
    return res.Attributes as PhiDocument;
}

/**
 * Moves a document to the trash (see TRASH_RETENTION_DAYS above) — used by
 * the admin "remove" action (see app/api/admin/documents/[id]/route.ts).
 * Deliberately admin-only: the family portal has no delete/remove
 * capability at all (by design — see app/portal/PortalDashboard.tsx). The
 * S3 object is left untouched; only the DynamoDB row is marked.
 */
export async function softDeleteDocument(patientId: string, documentId: string): Promise<PhiDocument> {
    const c = requireClient();
    const res = await c.send(
          new UpdateCommand({
                  TableName: TABLE_NAME,
                  Key: { patientId, documentId },
                  UpdateExpression: "SET deletedAt = :deletedAt, updatedAt = :updatedAt",
                  ConditionExpression: "attribute_exists(patientId)",
                  ExpressionAttributeValues: {
                            ":deletedAt": new Date().toISOString(),
                            ":updatedAt": new Date().toISOString(),
                  },
                  ReturnValues: "ALL_NEW",
          })
        );
    return res.Attributes as PhiDocument;
}

/** Undoes softDeleteDocument — brings a document back out of the trash. */
export async function restoreDocument(patientId: string, documentId: string): Promise<PhiDocument> {
    const c = requireClient();
    const res = await c.send(
          new UpdateCommand({
                  TableName: TABLE_NAME,
                  Key: { patientId, documentId },
                  UpdateExpression: "REMOVE deletedAt SET updatedAt = :updatedAt",
                  ConditionExpression: "attribute_exists(patientId)",
                  ExpressionAttributeValues: { ":updatedAt": new Date().toISOString() },
                  ReturnValues: "ALL_NEW",
          })
        );
    return res.Attributes as PhiDocument;
}

/**
 * Permanently removes a document's metadata row — only ever called by
 * sweepExpired() above, once its paired S3 object has already been (best-
 * effort) deleted. Not exported for use anywhere a "soft" delete is meant
 * instead; use softDeleteDocument for that.
 */
async function hardDeleteDocument(patientId: string, documentId: string): Promise<void> {
    const c = requireClient();
    await c.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { patientId, documentId } }));
}
