import { getAdminDashboard, listFeedback } from "./actions";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const [dashboard, feedback] = await Promise.all([
    getAdminDashboard(),
    listFeedback(false),
  ]);

  return <AdminClient initialDashboard={dashboard} initialFeedback={feedback} />;
}
