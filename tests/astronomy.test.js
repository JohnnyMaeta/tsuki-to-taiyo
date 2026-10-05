'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../astro-core.js'),A=require('../vendor/astronomy.browser.min.js');
const date=s=>new Date(s);
test('国立天文台2026年10月の朔弦望と1分以内で一致する',()=>{
  // https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou263.html (JST converted to UTC)
  for(const [angle,expected] of [[270,'2026-10-03T13:25Z'],[0,'2026-10-10T15:50Z'],[90,'2026-10-18T16:13Z'],[180,'2026-10-26T04:12Z']]) {
    const q=A.SearchMoonPhase(angle,date('2026-10-01T00:00Z'),31);
    assert.ok(Math.abs(+q.date-+date(expected))<60000);
  }
});
test('月齢は実際の新月でリセットし、一日後に1になる',()=>{
  const q=A.SearchMoonPhase(0,date('2026-10-01'),31).date;
  assert.ok(C.phase(new Date(+q-60000)).age>29);
  assert.ok(C.phase(new Date(+q+60000)).age<.001);
  assert.ok(Math.abs(C.phase(new Date(+q+86400000)).age-1)<.0001);
});
test('日本・半時間帯・日付変更線・夏時間を正しくUTCへ変換',()=>{
  for(const [d,t,z,expected] of [
    ['2026-10-05','18:00','Asia/Tokyo','2026-10-05T09:00:00.000Z'],
    ['2026-10-05','00:15','Asia/Kolkata','2026-10-04T18:45:00.000Z'],
    ['2026-10-05','00:00','Pacific/Kiritimati','2026-10-04T10:00:00.000Z'],
    ['2026-10-05','18:00','Australia/Sydney','2026-10-05T07:00:00.000Z']])assert.equal(C.localTime(d,t,z).date.toISOString(),expected);
  assert.throws(()=>C.localTime('2026-03-08','02:30','America/New_York'),/存在しません/);
  const overlap=C.localTime('2026-11-01','01:30','America/New_York');assert.equal(overlap.ambiguous,true);assert.equal(overlap.date.toISOString(),'2026-11-01T05:30:00.000Z');
});
test('不正入力とうるう年の境界',()=>{
  assert.throws(()=>C.localTime('2026-02-29','12:00','Asia/Tokyo'));
  assert.throws(()=>C.localTime('1899-12-31','12:00','Asia/Tokyo'));
  assert.throws(()=>C.localTime('2026-10-05','12:00','invalid/zone'));
  assert.equal(C.shiftDay('2028-02-28',1),'2028-02-29');assert.equal(C.shiftDay('2028-02-29',1),'2028-03-01');
  assert.throws(()=>C.sky(date('2026-10-05'),91,0));
});
test('同じ瞬間の月齢は共通、場所で空の位置が変わる',()=>{
  const d=date('2026-10-15T09:00Z'),north=C.sky(d,35.68,139.76),south=C.sky(d,-33.86,151.20);
  assert.equal(north.age,south.age);assert.equal(north.fraction,south.fraction);
  assert.ok(Math.abs(north.moon.altitude-south.moon.altitude)>10);
  assert.ok(Math.abs(north.tilt-south.tilt)>.5);
});
test('明るい側は太陽方向：独立した水平座標の投影式で傾きを検証',()=>{
  for(const lat of [-70,-33,0,35,70])for(const d of ['2026-10-14T09:00Z','2026-10-23T19:00Z','2026-10-30T23:00Z']){
    const t=date(d),g=C.sky(t,lat,140),r=Math.PI/180;
    const m=A.Horizon(t,g.observer,g.moon.eq.ra,g.moon.eq.dec,false),s=A.Horizon(t,g.observer,g.sun.eq.ra,g.sun.eq.dec,false);
    const da=(s.azimuth-m.azimuth)*r,ma=m.altitude*r,sa=s.altitude*r;
    const right=Math.cos(sa)*Math.sin(da),up=Math.sin(sa)*Math.cos(ma)-Math.cos(sa)*Math.sin(ma)*Math.cos(da);
    const angle=Math.atan2(-up,right);
    assert.ok(Math.abs(Math.sin(g.tilt-angle))<1e-8);
    assert.ok(Math.cos(g.tilt-angle)>0);
  }
});
test('月の出入りを現地日付内に限定し、極地の出入りなしも扱う',()=>{
  for(const [day,zone,lat,lon] of [['2026-10-05','Asia/Tokyo',35.6812,139.7671],['2026-03-08','America/New_York',40.71,-74],['2026-11-01','America/New_York',40.71,-74],['2026-06-21','Europe/Oslo',89,0]]){
    const g=C.sky(C.localTime(day,'12:00',zone).date,lat,lon),events=C.riseSet(day,zone,g.observer);
    for(const event of Object.values(events))if(event)assert.equal(C.dateText(event,zone),day);
    if(lat===89){assert.equal(events.sunrise,null);assert.equal(events.sunset,null);}
    if(day==='2026-10-05'){assert.equal(events.moonrise,null);assert.equal(C.timeText(events.moonset,zone),'14:16');}
  }
});

test('午前0時が夏時間で欠ける日と対応期間の最終日',()=>{
  for(const [day,zone,lat,lon] of [['2026-09-06','America/Santiago',-33.45,-70.67],['2100-12-31','Asia/Tokyo',35.68,139.76]]) {
    const g=C.sky(C.localTime(day,'12:00',zone).date,lat,lon);
    for(const event of Object.values(C.riseSet(day,zone,g.observer)))if(event)assert.equal(C.dateText(event,zone),day);
  }
});
