"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMonthlyStats } from "./actions";
import type { DayStat, OverallStats } from "./actions";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export default function StatsClient({
  initialYear,
  initialMonth,
  initialMonthStats,
  initialOverall,
}: {
  initialYear: number;
  initialMonth: number;
  initialMonthStats: DayStat[];
  initialOverall: OverallStats | null;
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [monthStats, setMonthStats] = useState<DayStat[]>(initialMonthStats);
  const [overall] = useState<OverallStats | null>(initialOverall);
  const [selectedDay, setSelectedDay] = useState<DayStat | null>(null);
  const [loading, setLoading] = useState(false);
  const isFirstRender = useRef(true);

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const ms = await getMonthlyStats(y, m);
    setMonthStats(ms);
    setLoading(false);
  }, []);

  // 월 변경 시에만 재조회 (초기 마운트는 SSR로 이미 있음)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
    setSelectedDay(null);
  };

  // 캘린더 계산
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayStatMap: Record<string, DayStat> = {};
  monthStats.forEach((d) => { dayStatMap[d.date] = d; });

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const getDateStr = (day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getCellColor = (day: number) => {
    const stat = dayStatMap[getDateStr(day)];
    if (!stat) return "transparent";
    if (stat.completed >= 10) return "var(--theme-accent)";
    if (stat.completed >= 5) return "var(--theme-gold)";
    if (stat.completed >= 1) return "var(--theme-placeholder)";
    return "transparent";
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto scrollbar-hide p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="pixel-button px-3 py-1 font-pixel text-xs text-theme">←</button>
        <h1 className="font-pixel text-sm text-theme">통계</h1>
      </div>

      {/* 캘린더 */}
      <div className="pixel-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="pixel-button px-2 py-1 font-pixel text-xs text-theme">◀</button>
          <span className="font-pixel text-sm text-theme">{year}년 {month}월</span>
          <button onClick={nextMonth} className="pixel-button px-2 py-1 font-pixel text-xs text-theme">▶</button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map((d, i) => (
            <div key={i} className="text-center font-pixel text-xs text-theme-muted">{d}</div>
          ))}
        </div>

        {/* 날짜 셀 */}
        {loading ? (
          <div className="flex justify-center py-8">
            <p className="font-pixel text-xs text-theme-muted">로딩 중...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const dateStr = getDateStr(day);
              const stat = dayStatMap[dateStr];
              const isSelected = selectedDay?.date === dateStr;

              return (
                <button
                  key={i}
                  onClick={() => stat ? setSelectedDay(stat) : setSelectedDay(null)}
                  className="pixel-input flex flex-col items-center justify-center py-1"
                  style={{
                    minHeight: 36,
                    outline: isSelected ? `2px solid var(--theme-accent)` : "none",
                  }}
                >
                  <span className="font-pixel text-xs text-theme">{day}</span>
                  {stat && (
                    <span
                      className="mt-0.5 h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: getCellColor(day) }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 범례 */}
        <div className="mt-3 flex items-center justify-center gap-3 font-pixel text-xs text-theme-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--theme-placeholder)" }} /> 1+
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--theme-gold)" }} /> 5+
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--theme-accent)" }} /> 10+
          </span>
        </div>
      </div>

      {/* 선택된 날 상세 */}
      {selectedDay && (
        <div className="pixel-panel p-4">
          <h3 className="font-pixel text-xs text-theme-muted">{selectedDay.date}</h3>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">완료 투두</span>
              <span className="text-theme">{selectedDay.completed}개</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">획득 골드</span>
              <span style={{ color: "var(--theme-gold)" }}>{selectedDay.gold}G</span>
            </div>
            {selectedDay.care > 0 && (
              <div className="flex justify-between font-pixel text-xs">
                <span className="text-theme-muted">돌봄</span>
                <span className="text-theme">{selectedDay.care}회</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 전체 통계 */}
      {overall && (
        <div className="pixel-panel p-4">
          <h2 className="font-pixel text-sm text-theme">전체 통계</h2>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">연속 접속</span>
              <span className="text-theme">{overall.streakDays}일</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">총 완료 투두</span>
              <span className="text-theme">{overall.totalTodos}개</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">총 획득 골드</span>
              <span style={{ color: "var(--theme-gold)" }}>{overall.totalGold}G</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">수집 가디언</span>
              <span className="text-theme">{overall.totalGuardians}마리</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">아이템 도감</span>
              <span className="text-theme">{overall.totalItems}종</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">총 돌봄</span>
              <span className="text-theme">{overall.totalCare}회</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">보낸 하트</span>
              <span className="text-theme">{overall.totalHearts}개</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">가입일</span>
              <span className="text-theme">
                {overall.joinDate ? new Date(overall.joinDate).toLocaleDateString("ko-KR") : "-"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
