import { getPotions } from "./actions";
import FortuneClient from "./FortuneClient";

export default async function FortunePage() {
  const initialPotions = await getPotions();
  return <FortuneClient initialPotions={initialPotions} />;
}
