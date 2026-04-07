"use client";

import { useState, useCallback } from "react";
import { startGuardian, recordGrowth, evolveGuardian, getTodayCare, getOwnedItemsByCategory, useCareItem, getOwnedPotions, getTodayActivity } from "./actions";
import type { CareStatus, OwnedCareItem, OwnedPotion, ActivityLog } from "./actions";
import { calcProbabilities } from "./probabilities";
import { useGold } from "@/components/GoldProvider";
import { useToast } from "@/components/Toast";
import EvolutionReveal from "./EvolutionReveal";

type GuardianState = "idle" | "growing" | "ready";

type GrowthData = {
  status: string;
  total_growth: number;
  max_growth: number;
  period_days: number;
  start_date: string;
  end_date: string;
  egg_image: string;
  daily_goal: number;
  today_growth: number;
  today_completed: number;
  total_goal: number;
  total_completed: number;
  total_care: number;
};

type EvolutionResult = {
  guardian_type_id: number;
  name: string;
  rarity: string;
  asset_key: string;
  achievement_rate: number;
  is_duplicate: boolean;
  duplicate_gold: number;
  period_days: number;
};

const PERIODS = [3, 7, 10, 15, 30] as const;
const GOALS = [1, 5, 10, 20] as const;

const PERIOD_LABELS: Record<number, string> = {
  3: "3일",
  7: "7일",
  10: "10일",
  15: "15일",
  30: "30일",
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <img
      src={`/ui/icons/${name}.png`}
      alt=""
      className="pixel-art"
      style={{ width: size, height: size }}
    />
  );
}

export type GuardianPageInitial = {
  state: GuardianState;
  growthData: GrowthData | null;
  careStatus: CareStatus;
  activityLogs: ActivityLog[];
};

export default function GuardianClient({ initial }: { initial: GuardianPageInitial }) {
  const [state, setState] = useState<GuardianState>(initial.state);
  const [growthData, setGrowthData] = useState<GrowthData | null>(initial.growthData);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(7);
  const [selectedGoal, setSelectedGoal] = useState<number>(5);
  const [showGrowthDetail, setShowGrowthDetail] = useState(false);
  const [careStatus, setCareStatus] = useState<CareStatus>(initial.careStatus);
  const [careCategory, setCareCategory] = useState<string | null>(null);
  const [careItems, setCareItems] = useState<OwnedCareItem[]>([]);
  const [careLoading, setCareLoading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(initial.activityLogs);
  const [showEvolveModal, setShowEvolveModal] = useState(false);
  const [potions, setPotions] = useState<OwnedPotion[]>([]);
  const [selectedPotion, setSelectedPotion] = useState<OwnedPotion | null>(null);
  const [starting, setStarting] = useState(false);
  const [evolving, setEvolving] = useState(false);
  const [evolutionResult, setEvolutionResult] = useState<EvolutionResult | null>(null);

  const { refresh: refreshGold } = useGold();
  const { show: showToast } = useToast();

  const loadData = useCallback(async () => {
    const data = await recordGrowth();

    if (!data || data.status === "no_active_guardian") {
      setState("idle");
      setGrowthData(null);
    } else if (data.status === "ready") {
      setState("ready");
      setGrowthData(data);
    } else {
      setState("growing");
      setGrowthData(data);
      const [care, logs] = await Promise.all([getTodayCare(), getTodayActivity()]);
      setCareStatus(care);
      setActivityLogs(logs);
    }
  }, []);

  const handleStart = async () => {
    setStarting(true);
    const result = await startGuardian(selectedPeriod, selectedGoal);
    if (result.error) {
      showToast(result.error);
    } else {
      showToast("가디가 태어났어요!", `${selectedPeriod}일간 함께해요`);
      await loadData();
    }
    setStarting(false);
  };

  const handleEvolveOpen = async () => {
    const owned = await getOwnedPotions();
    setPotions(owned);
    setSelectedPotion(null);
    setShowEvolveModal(true);
  };

  const handleEvolveConfirm = async () => {
    setShowEvolveModal(false);
    setEvolving(true);
    const result = await evolveGuardian(selectedPotion?.id);
    if (result.error) {
      showToast(result.error);
      setEvolving(false);
    } else if (result.data) {
      setEvolutionResult(result.data);
      refreshGold();
    }
  };

  const handleCareOpen = async (category: string) => {
    if (careStatus[category as keyof CareStatus]) {
      showToast("오늘 이미 돌봤어요!");
      return;
    }
    setCareLoading(true);
    setCareCategory(category);
    const items = await getOwnedItemsByCategory(category);
    setCareItems(items);
    setCareLoading(false);
  };

  const handleCareUse = async (itemId: number) => {
    const result = await useCareItem(itemId);
    if (result.error) {
      showToast(result.error);
    } else {
      showToast(`돌보기 완료! +1 성장치`, result.data?.new_collection ? "새 도감 등록!" : undefined);
      setCareCategory(null);
      refreshGold();
      await loadData();
    }
  };

  const handleEvolutionClose = () => {
    setEvolutionResult(null);
    setEvolving(false);
    loadData();
  };

  // ── 진화 연출 오버레이 ──
  if (evolutionResult) {
    return (
      <EvolutionReveal
        result={evolutionResult}
        onClose={handleEvolutionClose}
      />
    );
  }

  // ── 1. idle: 가디 없음 → 기간 선택 ──
  if (state === "idle") {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="pixel-panel flex flex-col items-center gap-3 p-6">
          <div className="pixel-input flex h-28 w-28 items-center justify-center">
            <img
              src="/ui/icons/egg.png"
              alt="알"
              className="pixel-art"
              style={{ width: 48, height: 48, opacity: 0.5 }}
            />
          </div>
          <p className="font-pixel text-sm text-theme">새로운 가디를 시작하세요</p>
          <p className="font-pixel text-xs text-theme-muted">
            기간과 목표를 정하고 TODO를 완료해서 가디를 키워보세요
          </p>
        </div>

        {/* 기간 선택 */}
        <div className="pixel-panel p-4">
          <h2 className="font-pixel text-sm text-theme">육성 기간</h2>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`pixel-button py-2 font-pixel text-xs ${
                  selectedPeriod === p ? "text-theme" : "text-theme-muted"
                }`}
                style={selectedPeriod === p ? { opacity: 1 } : { opacity: 0.5 }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <p className="mt-2 font-pixel text-xs text-theme-muted">
            기간이 길수록 희귀한 가디언을 얻을 확률이 높아요
          </p>
        </div>

        {/* 일일 목표 선택 */}
        <div className="pixel-panel p-4">
          <h2 className="font-pixel text-sm text-theme">일일 목표</h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGoal(g)}
                className={`pixel-button py-2 font-pixel text-xs ${
                  selectedGoal === g ? "text-theme" : "text-theme-muted"
                }`}
                style={selectedGoal === g ? { opacity: 1 } : { opacity: 0.5 }}
              >
                {g}개
              </button>
            ))}
          </div>
          <p className="mt-2 font-pixel text-xs text-theme-muted">
            매일 목표만큼 TODO를 완료하면 성장치 10을 얻어요
          </p>
        </div>

        {/* 시작 버튼 */}
        <button
          onClick={handleStart}
          disabled={starting}
          className="pixel-button py-3 font-pixel text-sm text-theme"
        >
          {starting ? "시작 중..." : "가디 키우기 시작!"}
        </button>
      </div>
    );
  }

  // ── 2/3. growing / ready ──
  const daysRemaining = growthData
    ? Math.max(0, Math.ceil((new Date(growthData.end_date + "T23:59:59+09:00").getTime() - Date.now()) / 86400000))
    : 0;
  const totalDays = growthData?.period_days || 1;
  const elapsedDays = totalDays - daysRemaining;
  const growthPercent = growthData
    ? Math.min(100, Math.round((growthData.total_growth / growthData.max_growth) * 100))
    : 0;
  const totalGoal = growthData?.total_goal ?? 0;
  const totalCompleted = growthData?.total_completed ?? 0;
  const totalCare = growthData?.total_care ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 알 이미지 */}
      <div className="pixel-panel flex flex-col items-center gap-3 p-6">
        <div className="pixel-input flex h-32 w-32 items-center justify-center">
          <img
            src={`/ui/guardi/egg/${growthData?.egg_image}`}
            alt="가디"
            className={`pixel-art ${state === "ready" ? "animate-egg-shake" : "animate-egg-float"}`}
            style={{ width: 64, height: 64 }}
          />
        </div>
        {state === "ready" ? (
          <>
            <p className="font-pixel text-sm text-theme">진화 준비 완료!</p>
            <p className="font-pixel text-xs text-theme-muted">
              가디가 가디언으로 성장할 준비가 되었어요
            </p>
          </>
        ) : (
          <>
            <p className="font-pixel text-sm text-theme">가디 육성 중</p>
            <p className="font-pixel text-xs text-theme-muted">
              {PERIOD_LABELS[totalDays]} 육성 · {elapsedDays}/{totalDays}일 경과
            </p>
          </>
        )}
      </div>

      {/* 성장 정보 */}
      <div className="pixel-panel p-4">
        <h2 className="font-pixel text-sm text-theme">성장 정보</h2>

        {/* 프로그레스 바 */}
        <div className="mt-3">
          <div className="pixel-input h-5 overflow-hidden p-0.5">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${growthPercent}%`,
                backgroundColor: "var(--theme-accent)",
                minWidth: growthPercent > 0 ? "4px" : "0",
              }}
            />
          </div>
          <p className="mt-1 text-right font-pixel text-xs text-theme-muted">
            {growthData?.total_growth ?? 0} / {growthData?.max_growth ?? 0} ({growthPercent}%)
          </p>
        </div>

        {/* 상세 토글 */}
        <button
          onClick={() => setShowGrowthDetail(!showGrowthDetail)}
          className="mt-2 flex w-full items-center justify-center gap-1 font-pixel text-xs text-theme-muted"
        >
          <span>{showGrowthDetail ? "접기" : "상세보기"}</span>
          <span style={{ fontSize: 10 }}>{showGrowthDetail ? "▲" : "▼"}</span>
        </button>

        {showGrowthDetail && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">남은 기간</span>
              <span className="text-theme">
                {state === "ready" ? "완료!" : `${daysRemaining}일`}
              </span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">총 목표</span>
              <span className="text-theme">{totalGoal}개</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">총 달성</span>
              <span className="text-theme">{totalCompleted}개</span>
            </div>
            <div className="flex justify-between font-pixel text-xs">
              <span className="text-theme-muted">총 돌봄</span>
              <span className="text-theme">{totalCare}회</span>
            </div>

            {/* 확률 표시 */}
            {growthData && (() => {
              const prob = calcProbabilities(
                growthData.period_days,
                Math.min(100, (growthData.total_growth / growthData.max_growth) * 100),
                Math.max(0, growthData.total_growth - growthData.max_growth)
              );
              return (
                <div className="mt-2 pt-2" style={{ borderTop: "1px dashed var(--theme-placeholder)" }}>
                  <p className="font-pixel text-xs text-theme-muted mb-1">현재 확률</p>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div><span className="font-pixel text-xs text-outline-dark" style={{ color: "#8a8a8a" }}>노말</span><br/><span className="font-pixel text-xs text-theme">{prob.normal.toFixed(1)}%</span></div>
                    <div><span className="font-pixel text-xs text-outline-dark" style={{ color: "#4a90d9" }}>레어</span><br/><span className="font-pixel text-xs text-theme">{prob.rare.toFixed(1)}%</span></div>
                    <div><span className="font-pixel text-xs text-outline-dark" style={{ color: "#9b59b6" }}>에픽</span><br/><span className="font-pixel text-xs text-theme">{prob.epic.toFixed(1)}%</span></div>
                    <div><span className="font-pixel text-xs text-outline-dark" style={{ color: "#f1c40f" }}>유니크</span><br/><span className="font-pixel text-xs text-theme">{prob.unique.toFixed(1)}%</span></div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* 돌보기 (growing 상태) */}
      {state === "growing" && (
        <div className="pixel-panel p-4">
          <h2 className="font-pixel text-sm text-theme">돌보기</h2>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {([
              { key: "food", icon: "🍞", label: "음식" },
              { key: "play", icon: "⚽", label: "놀이" },
              { key: "hygiene", icon: "🛁", label: "위생" },
              { key: "sleep", icon: "😴", label: "수면" },
            ] as const).map((c) => {
              const done = careStatus[c.key as keyof CareStatus];
              return (
                <button
                  key={c.key}
                  onClick={() => handleCareOpen(c.key)}
                  className="pixel-button flex flex-col items-center gap-1 py-3"
                  style={{ opacity: done ? 0.4 : 1 }}
                >
                  <span className="text-xl">{c.icon}</span>
                  <span className="font-pixel text-xs text-theme-muted">
                    {done ? "완료" : c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 오늘의 기록 */}
      {state === "growing" && activityLogs.length > 0 && (
        <div className="pixel-panel p-4">
          <h2 className="font-pixel text-sm text-theme">오늘의 기록</h2>
          <div className="mt-3 space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
            {activityLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-2 font-pixel text-xs">
                <span className="shrink-0">
                  {log.type === "todo" && "✅"}
                  {log.type === "care" && "💝"}
                  {(log.type === "buy_item" || log.type === "buy_potion") && "🛒"}
                  {log.type === "heart_given" && "💗"}
                  {log.type === "heart_received" && "❤️"}
                </span>
                <span className="flex-1 text-theme truncate">
                  {log.type === "todo" && `${log.title} 완료!`}
                  {log.type === "care" && `${log.title}(으)로 돌봄`}
                  {log.type === "buy_item" && `${log.title} 구매`}
                  {log.type === "buy_potion" && `${log.title} 구매`}
                  {log.type === "heart_given" && log.title}
                  {log.type === "heart_received" && log.title}
                </span>
                {log.gold !== 0 && (
                  <span
                    className="shrink-0 font-pixel text-xs"
                    style={{ color: log.gold > 0 ? "var(--theme-gold)" : "var(--theme-accent)" }}
                  >
                    {log.gold > 0 ? `+${log.gold}G` : `${log.gold}G`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 진화 버튼 (ready 상태) */}
      {state === "ready" && (
        <button
          onClick={handleEvolveOpen}
          disabled={evolving}
          className="pixel-button py-3 font-pixel text-sm text-theme animate-egg-shake"
        >
          {evolving ? "진화 중..." : "✨ 진화하기"}
        </button>
      )}

      {/* 진화 확인 모달 */}
      {showEvolveModal && growthData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setShowEvolveModal(false)}
        >
          <div
            className="pixel-panel w-full max-w-[320px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-pixel text-sm text-theme text-center mb-3">진화 확률</h3>

            {/* 확률 표시 */}
            {(() => {
              const prob = calcProbabilities(
                growthData.period_days,
                Math.min(100, (growthData.total_growth / growthData.max_growth) * 100),
                Math.max(0, growthData.total_growth - growthData.max_growth),
                selectedPotion ? {
                  rare_mult: selectedPotion.rare_mult,
                  epic_mult: selectedPotion.epic_mult,
                  unique_mult: selectedPotion.unique_mult,
                  normal_guarantee: selectedPotion.normal_guarantee,
                } : undefined
              );
              return (
                <div className="grid grid-cols-4 gap-2 text-center mb-4">
                  <div className="pixel-input py-2">
                    <span className="font-pixel text-xs text-outline-dark" style={{ color: "#8a8a8a" }}>노말</span>
                    <p className="font-pixel text-sm text-theme">{prob.normal.toFixed(1)}%</p>
                  </div>
                  <div className="pixel-input py-2">
                    <span className="font-pixel text-xs text-outline-dark" style={{ color: "#4a90d9" }}>레어</span>
                    <p className="font-pixel text-sm text-theme">{prob.rare.toFixed(1)}%</p>
                  </div>
                  <div className="pixel-input py-2">
                    <span className="font-pixel text-xs text-outline-dark" style={{ color: "#9b59b6" }}>에픽</span>
                    <p className="font-pixel text-sm text-theme">{prob.epic.toFixed(1)}%</p>
                  </div>
                  <div className="pixel-input py-2">
                    <span className="font-pixel text-xs text-outline-dark" style={{ color: "#f1c40f" }}>유니크</span>
                    <p className="font-pixel text-sm text-theme">{prob.unique.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })()}

            {/* 포션 선택 */}
            {potions.length > 0 && (
              <div className="mb-4">
                <p className="font-pixel text-xs text-theme-muted mb-2">물약 사용 (선택)</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedPotion(null)}
                    className="pixel-button px-2 py-1 font-pixel text-[10px]"
                    style={{ opacity: selectedPotion === null ? 1 : 0.4, color: "var(--theme-text)" }}
                  >
                    없음
                  </button>
                  {potions.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPotion(p)}
                      className="pixel-button flex items-center gap-1 px-2 py-1"
                      style={{ opacity: selectedPotion?.id === p.id ? 1 : 0.4 }}
                    >
                      <img
                        src={`/ui/items/${p.asset_key}.png`}
                        alt={p.name}
                        className="pixel-art"
                        style={{ width: 16, height: 16 }}
                      />
                      <span className="font-pixel text-xs text-theme">{p.name}</span>
                      <span className="font-pixel text-[10px] text-theme-muted">x{p.quantity}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleEvolveConfirm}
                className="pixel-button flex-1 py-2 font-pixel text-sm text-theme"
              >
                진화!
              </button>
              <button
                onClick={() => setShowEvolveModal(false)}
                className="pixel-button flex-1 py-2 font-pixel text-sm text-theme-muted"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 아이템 선택 모달 */}
      {careCategory && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-16"
          onClick={() => setCareCategory(null)}
        >
          <div
            className="pixel-panel w-full max-w-sm p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-pixel text-sm text-theme">
              아이템 선택
            </h3>
            {careLoading ? (
              <p className="mt-3 font-pixel text-xs text-theme-muted text-center">로딩 중...</p>
            ) : careItems.length === 0 ? (
              <p className="mt-3 font-pixel text-xs text-theme-muted text-center">
                소지한 아이템이 없어요. 가디용품점에서 구매해주세요!
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-4 gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                {careItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleCareUse(item.id)}
                    className="pixel-input flex flex-col items-center gap-1 p-2"
                  >
                    <img
                      src={`/ui/items/${item.asset_key}.png`}
                      alt={item.name}
                      className="pixel-art"
                      style={{ width: 28, height: 28 }}
                    />
                    <span className="font-pixel text-[10px] text-theme leading-tight">{item.name}</span>
                    <span className="font-pixel text-[10px] text-theme-muted">x{item.quantity}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setCareCategory(null)}
              className="pixel-button mt-3 w-full py-2 font-pixel text-xs text-theme-muted"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
