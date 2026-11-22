import { pool, rows } from "./db";
import type { ResultSetHeader } from "mysql2";
export interface CFSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: {
    contestId?: number;
    index: string;
    name: string;
    rating?: number;
    tags?: string[];
  };
}
export interface CFContest {
  id: number;
  name: string;
  startTimeSeconds?: number;
  durationSeconds: number;
  phase: string;
}
let lastCFRequest = 0;
let apiQueue: Promise<unknown> = Promise.resolve();
async function requestCodeforces<T>(
  method: string,
  params: Record<string, string> = {},
): Promise<T> {
  async function action() {
    const remaining = 2300 - (Date.now() - lastCFRequest);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    lastCFRequest = Date.now();
    const url = new URL(`https://codeforces.com/api/${method}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url, { signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error(`Codeforces HTTP ${response.status}`);
    const body = (await response.json()) as {
      status: "OK" | "FAILED";
      comment?: string;
      result?: T;
    };
    if (body.status !== "OK" || body.result === undefined)
      throw new Error(body.comment || "Codeforces returned an error");
    return body.result;
  }
  const promise = apiQueue.then(action, action);
  apiQueue = promise.then(
    () => undefined,
    () => undefined,
  );
  return promise;
}
export async function syncUser(
  handle: string,
  startDay: string,
  incremental = false,
) {
  // Fetch up to 10k most recent submissions, paging until before the journey start.
  // Previous local history is never deleted by a partial or interrupted sync.
  let fetched = 0,
    inserted = 0,
    reachedLimit = false;
  const startEpoch =
    Math.floor(new Date(`${startDay}T00:00:00Z`).getTime() / 1000) - 172800;
  const [lastSeen] = incremental
    ? await rows(
        "SELECT MAX(submitted_seconds) AS lastSeen FROM cf_submissions WHERE handle=?",
        [handle],
      )
    : [{ lastSeen: 0 }];
  // Refresh two days of overlapping submissions to capture delayed verdict changes.
  const cutoff = Math.max(startEpoch, Number(lastSeen?.lastSeen || 0) - 172800);
  for (let from = 1; from <= 10000; from += 1000) {
    const subs = await requestCodeforces<CFSubmission[]>("user.status", {
      handle,
      from: String(from),
      count: "1000",
    });
    fetched += subs.length;
    for (const s of subs) {
      if (!s.problem || !s.creationTimeSeconds) continue;
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO cf_submissions
       (id,handle,contest_id,problem_index,problem_name,verdict,rating,tags,submitted_seconds)
       VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE verdict=VALUES(verdict),rating=VALUES(rating),tags=VALUES(tags)`,
        [
          s.id,
          handle,
          s.problem.contestId ?? s.contestId ?? null,
          s.problem.index || "",
          s.problem.name || "Unnamed problem",
          s.verdict || "UNKNOWN",
          s.problem.rating ?? null,
          JSON.stringify(s.problem.tags || []),
          s.creationTimeSeconds,
        ],
      );
      inserted += result.affectedRows === 1 ? 1 : 0;
    }
    if (
      subs.length < 1000 ||
      subs[subs.length - 1].creationTimeSeconds < cutoff
    )
      break;
    if (from === 9001) reachedLimit = true;
  }
  return { fetched, inserted, reachedLimit };
}
let refreshedAt = 0;
export async function refreshContests(force = false) {
  if (!force && Date.now() - refreshedAt < 30 * 60 * 1000)
    return { cached: true };
  const contests = await requestCodeforces<CFContest[]>("contest.list", {
    gym: "false",
  });

  const future = contests.filter(
    (c): c is CFContest & { startTimeSeconds: number } =>
      c.startTimeSeconds !== undefined &&
      c.startTimeSeconds > Date.now() / 1000 - 86400,
  );

  for (const c of future) {
    await pool.execute(
      `INSERT INTO cf_contests(id,name,start_seconds,duration_seconds,phase)
      VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),start_seconds=VALUES(start_seconds),
      duration_seconds=VALUES(duration_seconds),phase=VALUES(phase)`,
      [c.id, c.name, c.startTimeSeconds, c.durationSeconds, c.phase],
    );
  }
  refreshedAt = Date.now();
  return { cached: false, total: future.length };
}
export async function upcomingContests() {
  return rows(`SELECT id,name,start_seconds AS startSeconds,duration_seconds AS durationSeconds,phase
    FROM cf_contests WHERE start_seconds > UNIX_TIMESTAMP()-300 ORDER BY start_seconds ASC LIMIT 60`);
}
export async function dueReminders() {
  const [setting] = await rows(
    `SELECT notifications_enabled FROM settings WHERE id=1`,
  );
  if (!setting?.notifications_enabled) return [];
  const contests =
    await rows(`SELECT id,name,start_seconds AS startSeconds FROM cf_contests
    WHERE start_seconds BETWEEN UNIX_TIMESTAMP() AND UNIX_TIMESTAMP()+1800
    ORDER BY start_seconds`);
  const due = [];
  for (const c of contests) {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT IGNORE INTO contest_reminders(contest_id,kind) VALUES(?,?)",
      [c.id, "30m"],
    );
    if (result.affectedRows) due.push(c);
  }
  return due;
}
