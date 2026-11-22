import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { pool, rows, initializeDatabase } from './db';
import { dayKeyValid } from './logic';
import { getSnapshot } from './analytics';
import { dueReminders, refreshContests, syncUser, upcomingContests } from './codeforces';
import type { ResultSetHeader } from 'mysql2';

const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'32mb'}));
app.use((req,res,next) => {
  // Local-only desktop service: reject cross-site form/JSON mutation attempts.
  if (['POST','PATCH','PUT','DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(?:127\.0\.0\.1|localhost):(4618|5173)$/.test(origin)) {
      res.status(403).json({error:'Cross-origin changes are disabled'}); return;
    }
    if (!req.is('application/json')) { res.status(415).json({error:'JSON content-type required'}); return; }
  }
  next();
});
type Handler = (req:Request,res:Response)=>Promise<unknown>;
const asyncRoute = (fn:Handler) => (req:Request,res:Response,next:NextFunction) => Promise.resolve(fn(req,res)).catch(next);
function bad(message:string):never { throw Object.assign(new Error(message),{status:400}); }
const date = z.string().refine(dayKeyValid,'Use YYYY-MM-DD');
const setupSchema=z.object({
  startDay:date,endDay:date,timezone:z.string().min(1).max(80).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid time zone').default('Asia/Tashkent'),
  codeforcesHandle:z.string().trim().max(80).default(''),dailyGoal:z.number().int().min(1).max(30).default(2),
  notificationsEnabled:z.boolean().default(true)
}).refine(v=>v.startDay<=v.endDay,{message:'End date must be on or after start date'});
const problemSchema=z.object({
  title:z.string().trim().min(1).max(200),platform:z.enum(['Codeforces','NeetCode','AtCoder','Other']).default('Other'),
  difficulty:z.string().max(32).default('Unrated'),problemUrl:z.union([z.literal(''),z.string().url().startsWith('https://').max(500)]).default(''),
  topic:z.string().max(80).default(''),notes:z.string().max(5000).default(''),solvedDay:date
});
app.get('/api/health', (_req,res)=>res.json({ok:true,app:'ICPC Orbit'}));
app.get('/api/bootstrap',asyncRoute(async(_req,res)=>res.json(await getSnapshot())));
app.put('/api/settings',asyncRoute(async(req,res)=>{
  const settings=setupSchema.parse(req.body);
  await pool.execute(`INSERT INTO settings(id,start_day,end_day,timezone,codeforces_handle,daily_goal,notifications_enabled)
    VALUES(1,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE start_day=VALUES(start_day),end_day=VALUES(end_day),
    timezone=VALUES(timezone),codeforces_handle=VALUES(codeforces_handle),daily_goal=VALUES(daily_goal),
    notifications_enabled=VALUES(notifications_enabled)`,
    [settings.startDay,settings.endDay,settings.timezone,settings.codeforcesHandle,settings.dailyGoal,settings.notificationsEnabled]);
  res.json({ok:true});
}));
app.post('/api/problems',asyncRoute(async(req,res)=>{
  const p=problemSchema.parse(req.body);
  const [result]=await pool.execute<ResultSetHeader>(`INSERT INTO manual_problems
    (title,platform,difficulty,problem_url,topic,notes,solved_day) VALUES(?,?,?,?,?,?,?)`,
    [p.title,p.platform,p.difficulty,p.problemUrl,p.topic,p.notes,p.solvedDay]);
  res.status(201).json({id:result.insertId});
}));
app.put('/api/problems/:id',asyncRoute(async(req,res)=>{
  const p=problemSchema.parse(req.body);
  const id=Number(req.params.id); if (!Number.isSafeInteger(id)||id<1) bad('Invalid ID');
  const [result]=await pool.execute<ResultSetHeader>(`UPDATE manual_problems SET
    title=?,platform=?,difficulty=?,problem_url=?,topic=?,notes=?,solved_day=? WHERE id=?`,
    [p.title,p.platform,p.difficulty,p.problemUrl,p.topic,p.notes,p.solvedDay,id]);
  if (!result.affectedRows) {res.status(404).json({error:'Problem not found'});return;}
  res.json({ok:true});
}));
app.delete('/api/problems/:id',asyncRoute(async(req,res)=>{
  const id=Number(req.params.id); if (!Number.isSafeInteger(id)||id<1) bad('Invalid ID');
  await pool.execute('DELETE FROM manual_problems WHERE id=?',[id]); res.json({ok:true});
}));
app.patch('/api/lessons/:id',asyncRoute(async(req,res)=>{
  const {completed,day}=z.object({completed:z.boolean(),day:date}).parse(req.body);
  const id=Number(req.params.id); if (!Number.isSafeInteger(id)||id<1) bad('Invalid ID');
  const [result]=await pool.execute<ResultSetHeader>('UPDATE lessons SET completed=?,completed_day=? WHERE id=?',
    [completed,completed?day:null,id]);
  if (!result.affectedRows) {res.status(404).json({error:'Lesson not found'});return;}
  res.json({ok:true});
}));
app.post('/api/study/start',asyncRoute(async(req,res)=>{
  const {lessonId,day}=z.object({lessonId:z.number().int().positive().nullable().default(null),day:date}).parse(req.body);
  const active=await rows('SELECT id FROM study_sessions WHERE ended_at IS NULL LIMIT 1');
  if (active.length) {res.status(409).json({error:'A study session is already running'});return;}
  const [result]=await pool.execute<ResultSetHeader>(
    'INSERT INTO study_sessions(started_at,study_day,lesson_id) VALUES(UTC_TIMESTAMP(),?,?)',[day,lessonId]);
  res.status(201).json({id:result.insertId});
}));
app.post('/api/study/stop',asyncRoute(async(_req,res)=>{
  const active=await rows('SELECT id FROM study_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1');
  if (!active.length) {res.json({ok:true,seconds:0});return;}
  await pool.execute(`UPDATE study_sessions SET ended_at=UTC_TIMESTAMP(),
    duration_seconds=GREATEST(1,TIMESTAMPDIFF(SECOND,started_at,UTC_TIMESTAMP())) WHERE id=?`,[active[0].id]);
  const [row]=await rows('SELECT duration_seconds AS seconds FROM study_sessions WHERE id=?',[active[0].id]);
  res.json({ok:true,seconds:row.seconds});
}));
app.post('/api/study/manual',asyncRoute(async(req,res)=>{
  const {day,minutes,lessonId,notes}=z.object({day:date,minutes:z.number().int().min(1).max(1440),
    lessonId:z.number().int().positive().nullable().default(null),notes:z.string().max(2000).default('')}).parse(req.body);
  await pool.execute(`INSERT INTO study_sessions(started_at,ended_at,duration_seconds,study_day,lesson_id,notes)
    VALUES(UTC_TIMESTAMP(),UTC_TIMESTAMP(),?,?,?,?)`,[minutes*60,day,lessonId,notes]);
  res.status(201).json({ok:true});
}));
app.delete('/api/study/:id',asyncRoute(async(req,res)=>{
  const id=Number(req.params.id); if (!Number.isSafeInteger(id)||id<1) bad('Invalid ID');
  await pool.execute('DELETE FROM study_sessions WHERE id=? AND ended_at IS NOT NULL',[id]);res.json({ok:true});
}));
let syncing=false;
async function autoSync() {
  if (syncing) return;
  const [s]=await rows('SELECT codeforces_handle AS handle,start_day AS startDay FROM settings WHERE id=1');
  if (!s?.handle) return;
  syncing=true;
  try { await syncUser(s.handle,s.startDay,true); }
  catch (e) { console.warn('Automatic Codeforces sync skipped:',(e as Error).message); }
  finally { syncing=false; }
}
app.post('/api/codeforces/sync',asyncRoute(async(_req,res)=>{
  if (syncing) {res.status(409).json({error:'A sync is already running'});return;}
  const [settings]=await rows('SELECT codeforces_handle AS handle,start_day AS startDay FROM settings WHERE id=1');
  if (!settings?.handle) bad('Enter your Codeforces handle in Settings first');
  syncing=true;
  try {const result=await syncUser(settings.handle,settings.startDay);res.json({ok:true,...result});}
  finally {syncing=false;}
}));
app.get('/api/contests',asyncRoute(async(_req,res)=>res.json(await upcomingContests())));
app.post('/api/contests/refresh',asyncRoute(async(_req,res)=>res.json(await refreshContests(true))));
app.post('/api/contests/due',asyncRoute(async(_req,res)=>res.json(await dueReminders())));
app.get('/api/export',asyncRoute(async(_req,res)=>{
  const snapshot=await getSnapshot();
  const submissions=await rows('SELECT * FROM cf_submissions');
  const reminders=await rows('SELECT * FROM contest_reminders');
  res.setHeader('Content-Disposition',`attachment; filename="icpc-orbit-backup-${new Date().toISOString().slice(0,10)}.json"`);
  res.json({format:'icpc-orbit-v1',exportedAt:new Date().toISOString(),...snapshot,cfSubmissionsRaw:submissions,reminders});
}));
app.post('/api/import',asyncRoute(async(req,res)=>{
  const backup=req.body;
  if (backup?.format!=='icpc-orbit-v1' || !Array.isArray(backup.problems) || !Array.isArray(backup.sessions) || !Array.isArray(backup.lessons)) bad('Not a valid ICPC Orbit backup');
  const db=await pool.getConnection();
  try {
    await db.beginTransaction();
    await db.query('DELETE FROM manual_problems');
    await db.query('DELETE FROM study_sessions');
    await db.query('DELETE FROM cf_submissions');
    await db.query('DELETE FROM contest_reminders');
    for (const l of backup.lessons) if (Number.isInteger(l.position) && ['beginner','advanced'].includes(l.course)) {
      await db.execute('UPDATE lessons SET completed=?,completed_day=? WHERE course=? AND position=?',
        [!!l.completed,l.completed?l.completedDay:null,l.course,l.position]);
    }
    for (const p of backup.problems) {
      const item=problemSchema.parse(p);
      await db.execute('INSERT INTO manual_problems(title,platform,difficulty,problem_url,topic,notes,solved_day) VALUES(?,?,?,?,?,?,?)',
        [item.title,item.platform,item.difficulty,item.problemUrl,item.topic,item.notes,item.solvedDay]);
    }
    for (const s of backup.sessions) {
      if (!dayKeyValid(s.studyDay) || !Number.isFinite(s.durationSeconds) || s.durationSeconds<0) bad('Invalid study session in backup');
      const started=typeof s.startedAt==='string' ? new Date(s.startedAt) : new Date();
      if (Number.isNaN(started.valueOf())) bad('Invalid study timestamp in backup');
      const ended=s.endedAt?new Date(s.endedAt):new Date();
      await db.execute('INSERT INTO study_sessions(started_at,ended_at,duration_seconds,study_day,lesson_id,notes) VALUES(?,?,?,?,?,?)',
        [started.toISOString().slice(0,19).replace('T',' '),ended.toISOString().slice(0,19).replace('T',' '),Math.floor(s.durationSeconds),s.studyDay,Number.isSafeInteger(s.lessonId)?s.lessonId:null,s.notes||'']);
    }
    for (const s of Array.isArray(backup.cfSubmissionsRaw)?backup.cfSubmissionsRaw:[]) {
      if (!Number.isSafeInteger(Number(s.id)) || !Number.isSafeInteger(Number(s.submitted_seconds))) continue;
      await db.execute(`INSERT IGNORE INTO cf_submissions(id,handle,contest_id,problem_index,problem_name,verdict,rating,tags,submitted_seconds)
        VALUES(?,?,?,?,?,?,?,?,?)`,[s.id,s.handle||'',s.contest_id??null,s.problem_index||'',s.problem_name||'',s.verdict||'',s.rating??null,
          typeof s.tags==='string'?s.tags:JSON.stringify(s.tags||[]),s.submitted_seconds]);
    }
    if (backup.settings) {
      const cfg=setupSchema.parse(backup.settings);
      await db.execute(`INSERT INTO settings(id,start_day,end_day,timezone,codeforces_handle,daily_goal,notifications_enabled)
        VALUES(1,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE start_day=VALUES(start_day),end_day=VALUES(end_day),timezone=VALUES(timezone),
        codeforces_handle=VALUES(codeforces_handle),daily_goal=VALUES(daily_goal),notifications_enabled=VALUES(notifications_enabled)`,
        [cfg.startDay,cfg.endDay,cfg.timezone,cfg.codeforcesHandle,cfg.dailyGoal,cfg.notificationsEnabled]);
    }
    await db.commit(); res.json({ok:true});
  } catch(e) {await db.rollback();throw e;} finally{db.release();}
}));
app.use('/api',(_req,res)=>res.status(404).json({error:'Unknown API endpoint'}));
const distPath=path.resolve(__dirname,'../../dist');
if (fs.existsSync(path.join(distPath,'index.html'))) {
  app.use(express.static(distPath));
  app.get('*',(_req,res)=>res.sendFile(path.join(distPath,'index.html')));
}
app.use((err:any,_req:Request,res:Response,_next:NextFunction)=>{
  const status=err instanceof z.ZodError?400:(err.status||500);
  const message=err instanceof z.ZodError ? err.issues.map(i=>i.message).join('; ') : (err?.message||'Unexpected error');
  console.error('[API]',message);
  res.status(status).json({error:message});
});
export async function startServer(port=Number(process.env.PORT||4618)) {
  await initializeDatabase();
  const server=await new Promise<import('http').Server>((resolve,reject)=>{
    const s=app.listen(port,'127.0.0.1',()=>resolve(s)); s.on('error',reject);
  });
  console.log(`ICPC Orbit API running at http://127.0.0.1:${port}`);
  void refreshContests().catch(e=>console.warn('Contest refresh postponed:',e.message));
  const initialSync=setTimeout(()=>void autoSync(),8000);
  const syncInterval=setInterval(()=>void autoSync(),20*60*1000);
  const refreshInterval=setInterval(()=>{void refreshContests().catch(e=>console.warn('Contest refresh:',e.message));},45*60*1000);
  server.on('close',()=>{clearTimeout(initialSync);clearInterval(syncInterval);clearInterval(refreshInterval);});
  return server;
}
if (require.main===module) startServer().catch(e=>{console.error('Cannot start ICPC Orbit:',e);process.exit(1);});
