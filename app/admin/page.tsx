import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getAdminCredentials, isPasswordExpired } from "@/lib/adminCredentials";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) redirect("/admin/login");

  // Forced password rotation: every 6 months, a signed-in admin is routed
  // to the change-password page before they can see the dashboard, rather
  // than this being something that only gets checked at login time (a
  // 12-hour session could otherwise straddle the expiry and never notice).
  const creds = await getAdminCredentials();
  if (creds && isPasswordExpired(creds.passwordChangedAt)) {
    redirect("/admin/change-password?reason=expired");
  }

  return <AdminDashboard username={session.username} />;
}
