/**
 * 日本の祝日取得（date.nager.at Public API を使用）
 * https://date.nager.at/api/v3/PublicHolidays/{year}/JP
 */

const API = "https://date.nager.at/api/v3/PublicHolidays";

const cache = new Map<number, Set<string>>();

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 指定年の祝日一覧を取得（YYYY-MM-DD の Set）。キャッシュする。
 */
export async function fetchHolidaysForYear(year: number): Promise<Set<string>> {
  if (cache.has(year)) return cache.get(year)!;
  try {
    const res = await fetch(`${API}/${year}/JP`);
    if (!res.ok) return new Set();
    const data = await res.json() as { date: string }[];
    const set = new Set(data.map((e) => e.date));
    cache.set(year, set);
    return set;
  } catch {
    return new Set();
  }
}

/**
 * 指定日が祝日かどうか。year の祝日セットを渡す。
 */
export function isHoliday(date: Date, holidays: Set<string>): boolean {
  return holidays.has(toKey(date));
}
