import {addDays, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek, endOfWeek, eachDayOfInterval} from 'date-fns';
export const dateText=(d:string,pattern='MMM d, yyyy')=>format(parseISO(d),pattern);
export const iso=(d:Date)=>format(d,'yyyy-MM-dd');
export const formatClock=(seconds:number)=>{
  const s=Math.max(0,Math.floor(seconds));
  return [Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(n=>String(n).padStart(2,'0')).join(':');
};
export const humanTime=(seconds:number)=>{
  if(seconds<3600)return `${Math.floor(seconds/60)}m`;
  return `${(seconds/3600).toFixed(1)}h`;
};
export function calendarCells(monthDay:string){
  const m=parseISO(monthDay);
  return eachDayOfInterval({start:startOfWeek(startOfMonth(m)),end:endOfWeek(endOfMonth(m))});
}
export function heatmapWeeks(startDay:string,endDay:string){
  const first=startOfWeek(parseISO(startDay));
  const last=endOfWeek(parseISO(endDay));
  const weeks:Date[][]=[];
  const total=differenceInCalendarDays(last,first)+1;
  for(let n=0;n<total;n+=7)weeks.push(Array.from({length:7},(_,i)=>addDays(first,n+i)));
  return weeks;
}
