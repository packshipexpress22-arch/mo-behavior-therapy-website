import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyPatientSessionToken, PATIENT_COOKIE_NAME } from "@/lib/phiAuth";
import PortalDashboard from "./PortalDashboard";

export const dynamic = "force-dynamic";

export default function PortalPage() {
  const token = cookies().get(PATIENT_COOKIE_NAME)?.value;
  const session = verifyPatientSessionToken(token);
  if (!session) redirect("/portal/login");

  return <PortalDashboard email={session.email} />;
}
