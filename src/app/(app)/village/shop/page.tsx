import { getShopItems } from "./actions";
import ShopClient from "./ShopClient";

export default async function ShopPage() {
  const initialCategory = "food";
  const initialItems = await getShopItems(initialCategory);
  return <ShopClient initialCategory={initialCategory} initialItems={initialItems} />;
}
