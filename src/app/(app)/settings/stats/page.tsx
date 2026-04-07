import { getMonthlyStats, getOverallStats } from "./actions";
import StatsClient from "./StatsClient";

export default async function StatsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [monthStats, overall] = await Promise.all([
    getMonthlyStats(year, month),
    getOverallStats(),
  ]);

  return (
    <StatsClient
      initialYear={year}
      initialMonth={month}
      initialMonthStats={monthStats}
      initialOverall={overall}
    />
  );
}
