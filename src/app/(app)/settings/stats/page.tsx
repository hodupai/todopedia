import { getMonthlyStats, getOverallStats } from "./actions";
import { getRecentArchivedTodos } from "../../todo/actions";
import StatsClient from "./StatsClient";

export default async function StatsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [monthStats, overall, archivedTodos] = await Promise.all([
    getMonthlyStats(year, month),
    getOverallStats(),
    getRecentArchivedTodos(),
  ]);

  return (
    <StatsClient
      initialYear={year}
      initialMonth={month}
      initialMonthStats={monthStats}
      initialOverall={overall}
      initialArchivedTodos={archivedTodos}
    />
  );
}
