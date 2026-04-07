import { getSettingsPageData } from "./actions";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const initial = await getSettingsPageData();
  return <SettingsClient initial={initial} />;
}
