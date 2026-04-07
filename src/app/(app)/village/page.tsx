import { getWallPosts } from "./actions";
import VillageClient from "./VillageClient";

export default async function VillagePage() {
  const initialPosts = await getWallPosts();
  return <VillageClient initialPosts={initialPosts} />;
}
