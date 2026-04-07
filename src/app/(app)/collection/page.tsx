import { getGuardianTypes, getCollection, getCollectionSummary } from "./actions";
import CollectionClient from "./CollectionClient";

export default async function CollectionPage() {
  const [types, items, summary] = await Promise.all([
    getGuardianTypes(1),
    getCollection(1),
    getCollectionSummary(1),
  ]);

  return (
    <CollectionClient
      initialGuardian={{ types, items, summary }}
    />
  );
}
