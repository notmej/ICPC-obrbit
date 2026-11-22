import { rows } from './db';
import { calculateStreak, codeforcesProblemFromUrl, deriveTopic, localDay, problemIdentity } from './logic';
export async function getSnapshot() {
  const [setting] = await rows('SELECT start_day AS startDay,end_day AS endDay,timezone,codeforces_handle AS codeforcesHandle,daily_goal AS dailyGoal,notifications_enabled AS notificationsEnabled FROM settings WHERE id=1');
  if (setting) setting.notificationsEnabled = !!setting.notificationsEnabled;
  const lessons = await rows('SELECT id,course,section,title,position,url,completed,completed_day AS completedDay FROM lessons ORDER BY course DESC,position');
  const problems = await rows('SELECT id,title,platform,difficulty,problem_url AS problemUrl,topic,notes,solved_day AS solvedDay FROM manual_problems ORDER BY solved_day DESC,id DESC');
  const sessions = await rows('SELECT id,DATE_FORMAT(started_at,\'%Y-%m-%dT%H:%i:%sZ\') AS startedAt,DATE_FORMAT(ended_at,\'%Y-%m-%dT%H:%i:%sZ\') AS endedAt,duration_seconds AS durationSeconds,study_day AS studyDay,lesson_id AS lessonId,notes FROM study_sessions ORDER BY id DESC');
  const contests = await rows('SELECT id,name,start_seconds AS startSeconds,duration_seconds AS durationSeconds,phase FROM cf_contests WHERE start_seconds > UNIX_TIMESTAMP()-300 ORDER BY start_seconds ASC LIMIT 40');
  let submissions: any[] = [];
  if (setting?.codeforcesHandle) {
    submissions = await rows('SELECT id,contest_id AS contestId,problem_index AS problemIndex,problem_name AS problemName,rating,tags,submitted_seconds AS submittedSeconds FROM cf_submissions WHERE handle=? AND verdict=\'OK\' ORDER BY submitted_seconds ASC,id ASC',[setting.codeforcesHandle]);
  }
  const timezone = setting?.timezone || 'Asia/Tashkent';
  const manualKeys = new Set(problems.map(p => codeforcesProblemFromUrl(p.problemUrl)).filter(Boolean));
  const seen = new Set<string>();
  const uniqueAccepted: any[] = [];
  for (const s of submissions) {
    const key = problemIdentity(s.contestId,s.problemIndex,s.problemName);
    if (seen.has(key)) continue;
    seen.add(key);
    const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? JSON.parse(s.tags) : []);
    uniqueAccepted.push({ id:s.id,contestId:s.contestId,problemIndex:s.problemIndex,
      title:s.problemName,rating:s.rating,tags,topic:deriveTopic(tags),
      solvedDay:localDay(s.submittedSeconds*1000,timezone),
      problemUrl: s.contestId ? `https://codeforces.com/problemset/problem/${s.contestId}/${s.problemIndex}` : '',
      alreadyManual:manualKeys.has(key)
    });
  }
  const days: Record<string,{date:string;problems:number;manual:number;codeforces:number;seconds:number;lessons:number}> = {};
  const ensure=(d:string) => days[d] ||= {date:d,problems:0,manual:0,codeforces:0,seconds:0,lessons:0};
  for (const p of problems) { ensure(p.solvedDay).problems++; ensure(p.solvedDay).manual++; }
  for (const p of uniqueAccepted) if (!p.alreadyManual) { ensure(p.solvedDay).problems++; ensure(p.solvedDay).codeforces++; }
  for (const s of sessions) if (s.endedAt) ensure(s.studyDay).seconds += Number(s.durationSeconds);
  for (const l of lessons) if (l.completed && l.completedDay) ensure(l.completedDay).lessons++;
  const today = localDay(Date.now(),timezone);
  const inRange = (d:string) => !!setting && d>=setting.startDay && d<=setting.endDay;
  const daily = Object.values(days).filter(d=>inRange(d.date));
  const totalProblems = daily.reduce((s,d)=>s+d.problems,0);
  const totalSeconds = daily.reduce((s,d)=>s+d.seconds,0);
  const totalLessons = lessons.filter(l=>l.completed).length;
  const streak = calculateStreak(days,today);
  const activeSession = sessions.find(s=>!s.endedAt) || null;
  const categoryCounts: Record<string, number> = {};
  for (const p of uniqueAccepted.filter(p=>inRange(p.solvedDay))) if (p.topic) categoryCounts[p.topic] = (categoryCounts[p.topic]||0)+1;
  return {settings:setting || null, lessons,problems,sessions,submissions:uniqueAccepted,contests,days,
    stats:{totalProblems,totalSeconds,totalLessons,streak,activeDays:daily.filter(d=>d.problems || d.seconds>=60 || d.lessons).length,
      studyGoal:setting?.dailyGoal || 2,categoryCounts,today},activeSession};
}
