import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) redirect("/admin/login");

  return <AdminDashboard username={session.username} />;
}
