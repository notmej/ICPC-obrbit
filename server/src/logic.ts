export function localDay(timestamp: number | Date, timeZone: string): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch { return date.toISOString().slice(0,10); }
}
export function dayKeyValid(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === v;
}
export function problemIdentity(contestId: number | undefined, index: string | undefined, name: string): string {
  return contestId && index ? `${contestId}:${index}` : `name:${name.toLowerCase()}`;
}
export function deriveTopic(tags: string[]): string | null {
  const mapping: Array<[string, string]> = [
    ['dfs and similar','Graphs'], ['shortest paths','Graphs'], ['graphs','Graphs'], ['trees','Trees'],
    ['dp','Dynamic Programming'], ['data structures','Hashing'], ['binary search','Binary Search'],
    ['sortings','Sorting'], ['greedy','Arrays'], ['two pointers','Arrays'], ['bitmasks','Bit Manipulation'],
    ['strings','Arrays'], ['implementation','Arrays'], ['brute force','Backtracking']
  ];
  for (const [tag, topic] of mapping) if (tags.includes(tag)) return topic;
  return null;
}
export function calculateStreak(days: Record<string, {problems:number; seconds:number; lessons:number}>, today: string): number {
  const date = new Date(`${today}T12:00:00Z`);
  const qualifies = (key: string) => !!days[key] && (days[key].problems > 0 || days[key].seconds >= 60 || days[key].lessons > 0);
  // Preserve a streak through today even if today's activity hasn't happened yet.
  if (!qualifies(today)) date.setUTCDate(date.getUTCDate() - 1);
  let n = 0;
  for (let i=0;i<20000;i++) {
    const key = date.toISOString().slice(0,10);
    if (!qualifies(key)) break;
    n++; date.setUTCDate(date.getUTCDate()-1);
  }
  return n;
}
export function codeforcesProblemFromUrl(url: string): string | null {
  const m = url.match(/codeforces\.com\/(?:contest\/(\d+)\/problem\/([a-z0-9]+)|problemset\/problem\/(\d+)\/([a-z0-9]+))/i);
  return m ? `${m[1] || m[3]}:${(m[2] || m[4]).toUpperCase()}` : null;
}
