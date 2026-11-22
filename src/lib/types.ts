export type Page = 'overview'|'calendar'|'problems'|'curriculum'|'focus'|'contests'|'settings';
export interface Settings { startDay:string; endDay:string; timezone:string; codeforcesHandle:string; dailyGoal:number; notificationsEnabled:boolean; }
export interface Lesson {id:number;course:'beginner'|'advanced';section:string;title:string;position:number;url:string;completed:number|boolean;completedDay:string|null;}
export interface Problem {id:number;title:string;platform:string;difficulty:string;problemUrl:string;topic:string;notes:string;solvedDay:string;}
export interface Accepted {id:number;contestId?:number;problemIndex?:string;title:string;rating:number|null;tags:string[];topic:string|null;solvedDay:string;problemUrl:string;alreadyManual:boolean;}
export interface StudySession {id:number;startedAt:string;endedAt:string|null;durationSeconds:number;studyDay:string;lessonId:number|null;notes:string|null;}
export interface Contest {id:number;name:string;startSeconds:number;durationSeconds:number;phase:string;}
export interface DayData {date:string;problems:number;manual:number;codeforces:number;seconds:number;lessons:number;}
export interface Snapshot {settings:Settings|null;lessons:Lesson[];problems:Problem[];submissions:Accepted[];sessions:StudySession[];contests:Contest[];
  days:Record<string,DayData>;stats:{totalProblems:number;totalSeconds:number;totalLessons:number;streak:number;activeDays:number;studyGoal:number;categoryCounts:Record<string,number>;today:string;};
  activeSession:StudySession|null;}
export type ProblemDraft = Omit<Problem,'id'>;
