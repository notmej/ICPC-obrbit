import mysql, { type RowDataPacket } from 'mysql2/promise';
import { LESSONS } from './courses';
export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'orbit',
  password: process.env.MYSQL_PASSWORD || 'orbit_local_only',
  database: process.env.MYSQL_DATABASE || 'icpc_orbit',
  waitForConnections: true, connectionLimit: 6, dateStrings: true, timezone: 'Z',
  decimalNumbers: true
});
export type DBRow = RowDataPacket & Record<string, any>;
export async function rows<T = DBRow>(query: string, params: unknown[] = []): Promise<T[]> {
  const [result] = await pool.query(query, params);
  return result as T[];
}
export async function initializeDatabase() {
  let ready = false;
  for (let i=0;i<40;i++) {
    try { await pool.query('SELECT 1'); ready = true; break; }
    catch (e) { if (i === 39) throw e; await new Promise(r => setTimeout(r, 1500)); }
  }
  if (!ready) throw new Error('MySQL did not become ready');
  await pool.query(`CREATE TABLE IF NOT EXISTS settings (
    id TINYINT PRIMARY KEY, start_day DATE NOT NULL, end_day DATE NOT NULL,
    timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Tashkent',
    codeforces_handle VARCHAR(80) NOT NULL DEFAULT '',
    daily_goal INT NOT NULL DEFAULT 2, notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS lessons (
    id INT AUTO_INCREMENT PRIMARY KEY, course VARCHAR(24) NOT NULL,
    section VARCHAR(80) NOT NULL, title VARCHAR(150) NOT NULL,
    position INT NOT NULL, url VARCHAR(250) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE, completed_day DATE NULL,
    UNIQUE KEY course_position (course, position)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS manual_problems (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL,
    platform VARCHAR(32) NOT NULL, difficulty VARCHAR(32) NOT NULL DEFAULT 'Unrated',
    problem_url VARCHAR(500) NOT NULL DEFAULT '', topic VARCHAR(80) NOT NULL DEFAULT '',
    notes TEXT, solved_day DATE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (solved_day)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cf_submissions (
    id BIGINT PRIMARY KEY, handle VARCHAR(80) NOT NULL,
    contest_id INT NULL, problem_index VARCHAR(12) NOT NULL DEFAULT '',
    problem_name VARCHAR(200) NOT NULL, verdict VARCHAR(50) NOT NULL,
    rating INT NULL, tags JSON NOT NULL, submitted_seconds INT NOT NULL,
    INDEX (handle, submitted_seconds), INDEX (handle, verdict)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS study_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY, started_at DATETIME NOT NULL,
    ended_at DATETIME NULL, duration_seconds INT NOT NULL DEFAULT 0,
    study_day DATE NOT NULL, lesson_id INT NULL, notes TEXT,
    INDEX (study_day), INDEX (ended_at)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cf_contests (
    id INT PRIMARY KEY, name VARCHAR(255) NOT NULL,
    start_seconds INT NOT NULL, duration_seconds INT NOT NULL,
    phase VARCHAR(24) NOT NULL,
    INDEX (start_seconds)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS contest_reminders (
    contest_id INT NOT NULL, kind VARCHAR(24) NOT NULL,
    PRIMARY KEY(contest_id, kind)
  )`);
  // Use idempotent seeding; existing course completions survive every restart.
  for (const l of LESSONS) {
    await pool.execute(`INSERT INTO lessons(course,section,title,position,url) VALUES(?,?,?,?,?)
      ON DUPLICATE KEY UPDATE section=VALUES(section), title=VALUES(title), url=VALUES(url)`,
      [l.course,l.section,l.title,l.position,l.url]);
  }
}
