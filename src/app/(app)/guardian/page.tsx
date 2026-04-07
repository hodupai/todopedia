import { getGuardianPageData } from "./actions";
import GuardianClient from "./GuardianClient";

export default async function GuardianPage() {
  const initial = await getGuardianPageData();
  return <GuardianClient initial={initial} />;
}
