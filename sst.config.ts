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

    const site = new sst.aws.Nextjs("MoBehaviorTherapySite", {
      link: [leadsTable],
      environment: {
        LEAD_STORE: "file",
        EMAIL_PROVIDER: "smtp",
        NEXT_PUBLIC_SITE_URL: "https://mobehaviortherapy.com",
        NEXT_PUBLIC_COMPANY_PHONE: "+13057950600",
        NEXT_PUBLIC_COMPANY_PHONE_DISPLAY: "(305) 795-0600",
        COMPANY_NOTIFICATION_EMAIL: "mobehavior@mobehaviortherapy.com",
        LEADS_TABLE: leadsTable.name,
      },
    });

    return {
      url: site.url,
      leadsTable: leadsTable.name,
    };
  },
});
