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

    // Admin panel credentials — stored as SST secrets (encrypted in AWS,
    // never written into this file or committed to git). Set the actual
    // values per stage with:
    //   npx sst secret set AdminUser <username> --stage <stage>
    //   npx sst secret set AdminPasswordHash <scrypt$salt$hash> --stage <stage>
    //   npx sst secret set AdminSessionSecret <random-hex> --stage <stage>
    // If unset for a stage, the admin panel stays disabled (its existing
    // graceful-degradation behavior — see lib/adminAuth.ts / app/admin).
    const adminUser = new sst.Secret("AdminUser");
    const adminPasswordHash = new sst.Secret("AdminPasswordHash");
    const adminSessionSecret = new sst.Secret("AdminSessionSecret");

    // Patient portal (Paso 6) — magic-link session signing secret, same
    // mechanism as the admin secrets above, deliberately separate value so
    // an admin session token can never double as a patient session token.
    //   npx sst secret set PatientSessionSecret <random-hex> --stage <stage>
    const patientSessionSecret = new sst.Secret("PatientSessionSecret");

    // Email delivery — Resend (same provider/domain already verified for
    // the Vercel/leads pipeline at mobehaviortherapy.com; reused here so no
    // new DNS records are needed). Powers both the lead-notification emails
    // and the patient portal's magic-link emails (lib/email.ts's
    // sendEmail(), used by both). If unset, sendEmail() throws and callers
    // swallow the error (see app/api/portal/request-link/route.ts) rather
    // than surfacing a 500 to the user.
    //   npx sst secret set ResendApiKey <key> --stage <stage>
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
          ],
          resources: [`arn:aws:dynamodb:${awsRegion}:${awsAccountId}:table/${phiTableName}`],
        }),
      ],
    });

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
      ],
      environment: {
        LEAD_STORE: "file",
        EMAIL_PROVIDER: "resend",
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
      },
    });

    return {
      url: site.url,
      leadsTable: leadsTable.name,
    };
  },
});
