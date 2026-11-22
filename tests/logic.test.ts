import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateStreak,codeforcesProblemFromUrl,dayKeyValid,deriveTopic,localDay,problemIdentity} from '../server/src/logic';
import {LESSONS} from '../server/src/courses';
test('official NeetCode course lesson counts and deep links',()=>{
  assert.equal(LESSONS.filter(l=>l.course==='beginner').length,35);
  assert.equal(LESSONS.filter(l=>l.course==='advanced').length,22);
  assert.ok(LESSONS.find(l=>l.title==='Segment Tree')?.url.endsWith('/8'));
});
test('date handling including leap years and user timezone',()=>{
  assert.ok(dayKeyValid('2028-02-29'));
  assert.equal(dayKeyValid('2027-02-29'),false);
  assert.equal(localDay(new Date('2027-01-01T00:30:00Z'),'America/New_York'),'2026-12-31');
  assert.equal(localDay(new Date('2027-01-01T00:30:00Z'),'Asia/Tashkent'),'2027-01-01');
});
test('streak counts activities and allows until end of today',()=>{
  const days={'2027-01-01':{problems:2,seconds:0,lessons:0},'2027-01-02':{problems:0,seconds:61,lessons:0},'2027-01-03':{problems:0,seconds:0,lessons:0}};
  assert.equal(calculateStreak(days,'2027-01-03'),2);
  assert.equal(calculateStreak(days,'2027-01-04'),0);
});
test('Codeforces uniqueness, URL mapping and tag categorization',()=>{
  assert.equal(problemIdentity(123,'A','Problem'),'123:A');
  assert.equal(codeforcesProblemFromUrl('https://codeforces.com/contest/123/problem/A'),'123:A');
  assert.equal(codeforcesProblemFromUrl('https://codeforces.com/problemset/problem/123/A'),'123:A');
  assert.equal(deriveTopic(['dp','math']),'Dynamic Programming');
  assert.equal(deriveTopic(['graph','graphs','math']),'Graphs');
});
