import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    QueryCommand,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";

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
    fileName: string;
    contentType: string;
    documentType: DocumentType;
    s3Key: string;
    status: DocumentStatus;
    sizeBytes: number | null;
    createdAt: string;
    updatedAt: string;
};

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

export async function listDocumentsForPatient(patientId: string): Promise<PhiDocument[]> {
    const c = requireClient();
    const res = await c.send(
          new QueryCommand({
                  TableName: TABLE_NAME,
                  KeyConditionExpression: "patientId = :pid",
                  ExpressionAttributeValues: { ":pid": patientId },
                  ScanIndexForward: false,
          })
        );
    const items = (res.Items as PhiDocument[]) ?? [];
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
      .filter((d) => d.status === "uploaded")
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
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
