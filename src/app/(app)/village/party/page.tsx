import { getMyParties, getPendingInvites } from "../party-actions";
import PartyClient from "./PartyClient";

export default async function PartyPage() {
  const [initialParties, initialInvites] = await Promise.all([
    getMyParties(),
    getPendingInvites(),
  ]);
  return <PartyClient initialParties={initialParties} initialInvites={initialInvites} />;
}
