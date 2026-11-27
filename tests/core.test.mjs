import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateRange,rankTrips,validateRoom,escapeHtml} from '../core.js';
test('inclusive dates cross month, year and leap-day boundaries',()=>{
  assert.deepEqual(dateRange('2028-02-28','2028-03-01'),['2028-02-28','2028-02-29','2028-03-01']);
  assert.deepEqual(dateRange('2026-12-31','2027-01-01'),['2026-12-31','2027-01-01']);
});
test('invalid and excessive ranges rejected',()=>{
  for(const pair of [['2027-02-29','2027-03-01'],['2027-02-02','2027-02-01'],['2027-01-01','2027-12-31'],['','']]) assert.throws(()=>dateRange(...pair));
});
test('requires all consecutive days, and does not mark pending members available',()=>{
  const dates=dateRange('2027-01-01','2027-01-05'),room={dates,tripDays:3,expected:3};
  const members=[{name:'A',dates:[dates[0],dates[2],dates[3]]},{name:'B',dates:dates.slice(1,4)}];
  const result=rankTrips(room,members);
  assert.equal(result[0].start,dates[1]);assert.equal(result[0].count,1);assert.equal(result[0].everyone,false);
  assert.equal(result.find(r=>r.start===dates[0]).count,0);
});
test('full participation, ties and explicit unavailable votes',()=>{
  const dates=dateRange('2027-01-01','2027-01-03'),room={dates,tripDays:2,expected:2};
  const members=[{dates},{dates}];
  assert.equal(rankTrips(room,members)[0].everyone,true);
  assert.equal(rankTrips(room,members)[0].start,dates[0]);
  members.push({dates:[]});assert.equal(rankTrips(room,members)[0].everyone,false);
});
test('trip length, population and title validation',()=>{
  const input={title:' 제주 ',start:'2027-01-01',end:'2027-01-03',tripDays:'3',expected:'4'};
  assert.equal(validateRoom(input).title,'제주');
  for(const changes of [{tripDays:4},{tripDays:0},{expected:1},{expected:2.5},{title:' '}])assert.throws(()=>validateRoom({...input,...changes}));
});
test('user names are escaped for HTML',()=>{assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');});
