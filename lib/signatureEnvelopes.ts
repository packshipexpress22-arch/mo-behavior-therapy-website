import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";
import type { SignatureTemplate } from "./signatureTemplates";

// E-signature envelope metadata — DynamoDB only (SST-managed table, see
// SignatureEnvelopesTable in sst.config.ts). An "envelope" is one send of
// one template to one client: it freezes a snapshot of the template's
// content at send time, then accumulates the client's filled-in field
// values, their signature, and a basic audit trail once they complete it.
//
// Key shape mirrors lib/phiDocuments.ts: partition key `patientId` (the
// client's normalized email — reusing the exact same identity convention
// as the patient portal, though this module is intentionally independent
// of lib/phiAuth.ts's session system), sort key `envelopeId` (nanoid).
// This lets a future "my documents to sign" patient-facing list query by
// email directly, the same way PHI documents already do, without a GSI.

const TABLE_NAME = process.env.SIGNATURE_ENVELOPES_TABLE;

export function signatureEnvelopesConfigured(): boolean {
  return Boolean(TABLE_NAME);
}

const client = TABLE_NAME
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    })
  : null;

export type EnvelopeStatus = "sent" | "completed" | "voided";

export type SignatureValue =
  | { type: "drawn"; dataUrl: string }
  | { type: "typed"; typedName: string };

// A frozen copy of exactly what the client was shown — see the header note
// in lib/signatureTemplates.ts on why this is never re-derived from the
// live template after send time. Phase 2 (2026-10-08): also freezes the
// source-PDF reference and field positions for "pdf"-kind templates, same
// immutability guarantee — the admin can keep editing the template's field
// layout afterward without ever altering what a client already saw/signed.
export type TemplateSnapshot = Pick<
  SignatureTemplate,
  | "title"
  | "description"
  | "documentType"
  | "kind"
  | "blocks"
  | "sourcePdfKey"
  | "sourcePdfFileName"
  | "pageCount"
  | "fields"
  | "signatureLabel"
>;

export type SignatureEnvelope = {
  patientId: string; // normalized client email
  envelopeId: string;
  templateId: string;
  templateSnapshot: TemplateSnapshot;
  clientName: string;
  clientEmail: string;
  status: EnvelopeStatus;
  fieldValues: Record<string, string>;
  signature: SignatureValue | null;
  consentIp: string | null;
  consentTimestamp: string | null;
  consentUserAgent: string | null;
  pdfS3Key: string | null;
  sentBy: string; // admin username who sent it
  sentAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function requireClient() {
  if (!client || !TABLE_NAME) {
    throw new Error("signatureEnvelopes: SIGNATURE_ENVELOPES_TABLE is not configured");
  }
  return client;
}

export async function createEnvelope(args: {
  templateId: string;
  templateSnapshot: TemplateSnapshot;
  clientName: string;
  clientEmail: string;
  sentBy: string;
}): Promise<SignatureEnvelope> {
  const c = requireClient();
  const now = new Date().toISOString();
  const envelope: SignatureEnvelope = {
    patientId: args.clientEmail.trim().toLowerCase(),
    envelopeId: nanoid(12),
    templateId: args.templateId,
    templateSnapshot: args.templateSnapshot,
    clientName: args.clientName,
    clientEmail: args.clientEmail.trim().toLowerCase(),
    status: "sent",
    fieldValues: {},
    signature: null,
    consentIp: null,
    consentTimestamp: null,
    consentUserAgent: null,
    pdfS3Key: null,
    sentBy: args.sentBy,
    sentAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: envelope }));
  return envelope;
}

export async function getEnvelope(patientId: string, envelopeId: string): Promise<SignatureEnvelope | null> {
  const c = requireClient();
  const res = await c.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { patientId, envelopeId } })
  );
  return (res.Item as SignatureEnvelope) ?? null;
}

export async function completeEnvelope(args: {
  patientId: string;
  envelopeId: string;
  fieldValues: Record<string, string>;
  signature: SignatureValue;
  consentIp: string | null;
  consentUserAgent: string | null;
}): Promise<SignatureEnvelope> {
  const c = requireClient();
  const now = new Date().toISOString();
  const existing = await getEnvelope(args.patientId, args.envelopeId);
  if (!existing) throw new Error("envelope_not_found");
  const updated: SignatureEnvelope = {
    ...existing,
    status: "completed",
    fieldValues: args.fieldValues,
    signature: args.signature,
    consentIp: args.consentIp,
    consentUserAgent: args.consentUserAgent,
    consentTimestamp: now,
    completedAt: now,
    updatedAt: now,
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
  return updated;
}

export async function setEnvelopePdfKey(
  patientId: string,
  envelopeId: string,
  pdfS3Key: string
): Promise<void> {
  const c = requireClient();
  const existing = await getEnvelope(patientId, envelopeId);
  if (!existing) return;
  await c.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...existing, pdfS3Key, updatedAt: new Date().toISOString() },
    })
  );
}

/**
 * Admin-only: lists every envelope across all clients, for the admin
 * dashboard's "Signatures" tab. Same tiny-volume Scan justification as
 * lib/phiDocuments.ts's listAllDocuments() / lib/signatureTemplates.ts's
 * listTemplates().
 */
export async function listAllEnvelopes(): Promise<SignatureEnvelope[]> {
  const c = requireClient();
  const items: SignatureEnvelope[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await c.send(new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey }));
    items.push(...((res.Items as SignatureEnvelope[]) ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
