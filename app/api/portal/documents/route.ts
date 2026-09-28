import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { cookies } from "next/headers";
import { verifyPatientSessionToken, PATIENT_COOKIE_NAME } from "@/lib/phiAuth";
import { listDocumentsForPatient, putDocument, type DocumentType } from "@/lib/phiDocuments";
import { createUploadUrl, documentS3Key, phiStorageConfigured } from "@/lib/phiStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENT_TYPES = ["medical_evaluation", "insurance", "legal_consent", "other"] as const satisfies readonly DocumentType[];

// Conservative allowlist — documents patients realistically upload here
// (evaluations, insurance cards/letters, signed forms), not arbitrary
// files. Kept in sync with the accept="" attribute on the upload input in
// app/portal/PortalDashboard.tsx.
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);

const createSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(100),
  documentType: z.enum(DOCUMENT_TYPES),
});

function requireSession() {
  const token = cookies().get(PATIENT_COOKIE_NAME)?.value;
  return verifyPatientSessionToken(token);
}

export async function GET() {
  const session = requireSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const docs = await listDocumentsForPatient(session.patientId);
  return NextResponse.json({ documents: docs });
}

export async function POST(req: NextRequest) {
  const session = requireSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!phiStorageConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { fileName, contentType, documentType } = parsed.data;

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  const documentId = nanoid(12);
  const s3Key = documentS3Key(session.patientId, documentId, fileName);
  const now = new Date().toISOString();

  await putDocument({
    patientId: session.patientId,
    documentId,
    fileName,
    contentType,
    documentType,
    s3Key,
    status: "pending_upload",
    sizeBytes: null,
    createdAt: now,
    updatedAt: now,
  });

  const uploadUrl = await createUploadUrl({ s3Key, contentType });

  return NextResponse.json({ documentId, uploadUrl, s3Key });
}
