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

    const site = new sst.aws.Nextjs("MoBehaviorTherapySite", {
      link: [leadsTable, adminUser, adminPasswordHash, adminSessionSecret],
      environment: {
        LEAD_STORE: "file",
        EMAIL_PROVIDER: "smtp",
        NEXT_PUBLIC_SITE_URL: "https://mobehaviortherapy.com",
        NEXT_PUBLIC_COMPANY_PHONE: "+13057950600",
        NEXT_PUBLIC_COMPANY_PHONE_DISPLAY: "(305) 795-0600",
        COMPANY_NOTIFICATION_EMAIL: "mobehavior@mobehaviortherapy.com",
        LEADS_TABLE: leadsTable.name,
        ADMIN_USER: adminUser.value,
        ADMIN_PASSWORD_HASH: adminPasswordHash.value,
        ADMIN_SESSION_SECRET: adminSessionSecret.value,
      },
    });

    return {
      url: site.url,
      leadsTable: leadsTable.name,
    };
  },
});
