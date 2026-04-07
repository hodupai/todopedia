// KST(Asia/Seoul) 기준 오늘 날짜 (YYYY-MM-DD)
// SQL의 kst_today()와 일치해야 함. 모든 record_date 비교는 이걸 써야 함.
// (UTC 기준으로 자르면 KST 0시~9시 사이에 어제 날짜가 나옴)
export function kstToday(): string {
  const now = new Date();
  // UTC 시간에 +9h 더한 뒤 ISO에서 날짜 부분만
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}
