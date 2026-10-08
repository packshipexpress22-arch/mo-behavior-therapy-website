/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "mo-behavior-therapy",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: false,
      home: "aws",
    };
  },
  async run() {
    const leadsTable = new sst.aws.Dynamo("MoLeadsTable", {
      fields: {
        id: "string",
        gsi1pk: "string",
        gsi1sk: "string",
      },
      primaryIndex: { hashKey: "id" },
      globalIndexes: {
        gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
      },
    });

    // E-signature feature (added 2026-10-08) — two new, SST-managed
    // DynamoDB tables, same pattern as MoLeadsTable above: `link`-ing an
    // sst.aws.Dynamo resource automatically grants the Nextjs function
    // least-privilege CRUD on it, no manual IAM permission list needed
    // (unlike the PhiDocuments Linkable below, which wraps a table that
    // was created manually, outside SST's management).
    //
    // SignatureTemplatesTable: admin-authored document templates (title,
    // fillable fields, signature label) — see lib/signatureTemplates.ts.
    const signatureTemplatesTable = new sst.aws.Dynamo("SignatureTemplatesTable", {
      fields: { id: "string" },
      primaryIndex: { hashKey: "id" },
    });

    // SignatureEnvelopesTable: one send of one template to one client —
    // see lib/signatureEnvelopes.ts. Key shape mirrors the PhiDocuments
    // table (patientId + a nanoid sort key) so a future patient-facing
    // "documents to sign" list could query it the same way.
    const signatureEnvelopesTable = new sst.aws.Dynamo("SignatureEnvelopesTable", {
      fields: { patientId: "string", envelopeId: "string" },
      primaryIndex: { hashKey: "patientId", rangeKey: "envelopeId" },
    });

    // Signature-request link signing secret — same dependency-free HMAC
    // mechanism as the admin/patient-portal secrets below, deliberately a
    // separate value so a signing link can never double as an admin or
    // patient-portal session (see lib/signatureAuth.ts).
    // npx sst secret set SignatureSessionSecret <random-hex> --stage <stage>
    const signatureSessionSecret = new sst.Secret("SignatureSessionSecret");

    // Admin panel credentials — stored as SST secrets (encrypted in AWS,
    // never written into this file or committed to git). Set the actual
    // values per stage with:
    // npx sst secret set AdminUser <username> --stage <stage>
    // npx sst secret set AdminPasswordHash <scrypt$salt$hash> --stage <stage>
    // npx sst secret set AdminSessionSecret <random-hex> --stage <stage>
    // If unset for a stage, the admin panel stays disabled (its existing
    // graceful-degradation behavior — see lib/adminAuth.ts / app/admin).
    const adminUser = new sst.Secret("AdminUser");
    const adminPasswordHash = new sst.Secret("AdminPasswordHash");
    const adminSessionSecret = new sst.Secret("AdminSessionSecret");

    // Patient portal (Paso 6) — magic-link session signing secret, same
    // mechanism as the admin secrets above, deliberately separate value so
    // an admin session token can never double as a patient session token.
    // npx sst secret set PatientSessionSecret <random-hex> --stage <stage>
    const patientSessionSecret = new sst.Secret("PatientSessionSecret");

    // Email delivery — Resend (same provider/domain already verified for
    // the Vercel/leads pipeline at mobehaviortherapy.com; reused here so no
    // new DNS records are needed). Powers both the lead-notification emails
    // and the patient portal's magic-link emails (lib/email.ts's
    // sendEmail(), used by both). If unset, sendEmail() throws and callers
    // swallow the error (see app/api/portal/request-link/route.ts) rather
    // than surfacing a 500 to the user.
    // npx sst secret set ResendApiKey <key> --stage <stage>
    const resendApiKey = new sst.Secret("ResendApiKey");

    // PHI storage (Paso 2/3) — the S3 bucket and DynamoDB table were
    // created manually in the AWS console (before this app had any PHI
    // feature to provision them), not by SST/Pulumi. sst.Linkable wraps an
    // *existing* resource's name/ARN so the Nextjs function below gets
    // least-privilege IAM permissions to it via `link`, the same pattern
    // used for MoLeadsTable, without SST trying to create/manage/adopt the
    // resource itself (which would risk it, given it may hold real PHI).
    // Hardcoded rather than looked up dynamically — this is the AWS
    // account/region this whole app already lives in (see
    // claude/mo-hipaa-baa-setup-steps.md: account 226123186858, us-east-1).
    const phiBucketName = "mo-behavior-therapy-phi-documents";
    const phiTableName = "mo-behavior-therapy-phi-documents"; // same name, different resource type (S3 vs DynamoDB) — see claude/mo-hipaa-baa-setup-steps.md Paso 2/3
    const awsAccountId = "226123186858";
    const awsRegion = "us-east-1";

    const phiBucket = new sst.Linkable("PhiDocumentsBucket", {
      properties: { bucketName: phiBucketName },
      include: [
        sst.aws.permission({
          actions: ["s3:PutObject", "s3:GetObject", "s3:HeadObject"],
          resources: [`arn:aws:s3:::${phiBucketName}/*`],
        }),
      ],
    });

    const phiTable = new sst.Linkable("PhiDocumentsTable", {
      properties: { tableName: phiTableName },
      include: [
        sst.aws.permission({
          actions: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:Query",
            // "Scan" is needed by lib/phiDocuments.ts's listAllDocuments()
            // (the admin dashboard's "Documents" tab) - without it, that
            // Scan throws AccessDeniedException and the tab shows
            // "Couldn't load documents." (found + fixed 2026-10-02).
            "dynamodb:Scan",
          ],
          resources: [`arn:aws:dynamodb:${awsRegion}:${awsAccountId}:table/${phiTableName}`],
        }),
      ],
    });

    // Custom domain (Paso 7) — only attached for the "production" stage,
    // once the ACM certificate for mobehaviortherapy.com is ISSUED.
    // dns: false means SST does NOT try to manage DNS records itself
    // (the domain lives in Squarespace, not Route 53) — the final CNAME/
    // ALIAS record pointing mobehaviortherapy.com at this CloudFront
    // distribution is added manually in Squarespace once this deploys.
    const site = new sst.aws.Nextjs("MoBehaviorTherapySite", {
      link: [
        leadsTable,
        adminUser,
        adminPasswordHash,
        adminSessionSecret,
        patientSessionSecret,
        resendApiKey,
        phiBucket,
        phiTable,
        signatureTemplatesTable,
        signatureEnvelopesTable,
        signatureSessionSecret,
      ],
      domain:
        $app.stage === "production"
          ? {
              name: "mobehaviortherapy.com",
              dns: false,
              cert: "arn:aws:acm:us-east-1:226123186858:certificate/24ef417f-184c-407f-8bec-f3502a262c7f",
            }
          : undefined,
      environment: {
        LEAD_STORE: "file",
        EMAIL_PROVIDER: "resend",
        // Logs the submitter's IP address alongside their contact-consent
        // record (see app/api/leads/route.ts's `consent.ip` field). Off by
        // default; turned on 2026-10-02 at the user's request so the
        // consent record captures IP too. Also reused by the e-signature
        // feature's audit trail (see app/api/sign/[envelopeId]/submit/route.ts).
        LOG_IP_ADDRESSES: "true",
        NEXT_PUBLIC_SITE_URL: "https://mobehaviortherapy.com",
        NEXT_PUBLIC_COMPANY_PHONE: "+13057950600",
        NEXT_PUBLIC_COMPANY_PHONE_DISPLAY: "(305) 795-0600",
        COMPANY_NOTIFICATION_EMAIL: "mobehavior@mobehaviortherapy.com",
        LEADS_TABLE: leadsTable.name,
        ADMIN_USER: adminUser.value,
        ADMIN_PASSWORD_HASH: adminPasswordHash.value,
        ADMIN_SESSION_SECRET: adminSessionSecret.value,
        PATIENT_SESSION_SECRET: patientSessionSecret.value,
        RESEND_API_KEY: resendApiKey.value,
        PHI_BUCKET: phiBucketName,
        PHI_TABLE: phiTableName,
        SIGNATURE_TEMPLATES_TABLE: signatureTemplatesTable.name,
        SIGNATURE_ENVELOPES_TABLE: signatureEnvelopesTable.name,
        SIGNATURE_SESSION_SECRET: signatureSessionSecret.value,
      },
    });

    return {
      url: site.url,
      leadsTable: leadsTable.name,
    };
  },
});
