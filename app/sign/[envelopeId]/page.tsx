import SignatureSigningClient from "./SignatureSigningClient";

export const dynamic = "force-dynamic";

// No cookie-based auth check here, unlike app/admin/page.tsx or
// app/portal/page.tsx — a signing link is a bearer token in the URL, not a
// login session (see lib/signatureAuth.ts). The token is verified by the
// API routes on every request; this page just hands it to the client
// component that drives the fill-in/sign UI.
export default function SignPage({
  params,
  searchParams,
}: {
  params: { envelopeId: string };
  searchParams: { token?: string };
}) {
  return <SignatureSigningClient envelopeId={params.envelopeId} token={searchParams.token || ""} />;
}
