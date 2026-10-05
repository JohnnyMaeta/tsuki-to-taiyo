/* Astronomy/time functions are shared by the browser and the numerical tests. */
(function (root) {
  'use strict';
  const A = typeof module === 'object' ? require('./vendor/astronomy.browser.min.js') : root.Astronomy;
  const DAY = 86400000;
  const formatters = new Map();
  function parts(date, zone) {
    if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }));
    return Object.fromEntries(formatters.get(zone).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  }
  function dateText(date, zone) {
    const p = parts(date, zone); return `${p.year}-${p.month}-${p.day}`;
  }
  function timeText(date, zone) {
    const p = parts(date, zone); return `${p.hour}:${p.minute}`;
  }
  function wallEpoch(p) { return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +(p.second || 0)); }
  function localTime(day, clock, zone, boundary = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(clock)) throw new Error('日付と時こくを入力してください。');
    const nominal = new Date(`${day}T${clock}:00Z`);
    if (!Number.isFinite(+nominal) || nominal.toISOString().slice(0,16) !== `${day}T${clock}` || +day.slice(0,4) < 1900 || +day.slice(0,4) > (boundary ? 2101 : 2100)) throw new Error('1900〜2100年の正しい日付と時こくを指定してください。');
    const offsets = new Set();
    for (const delta of [-2,-1,0,1,2]) {
      const sample = new Date(+nominal + delta * DAY);
      offsets.add(wallEpoch(parts(sample, zone)) - +sample);
    }
    const candidates = [...offsets].map(offset => new Date(+nominal - offset)).filter(d => dateText(d, zone) === day && timeText(d, zone) === clock).sort((a,b) => a-b);
    if (!candidates.length) throw new Error('夏時間への切り替えなどで、この現地時刻は存在しません。別の時こくを選んでください。');
    return { date: candidates[0], ambiguous: candidates.length > 1 };
  }
  function shiftDay(day, n) {
    const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10);
  }
  function phase(date) {
    const last = A.SearchMoonPhase(0, date, -35);
    if (!last) throw new Error('新月の時刻を計算できませんでした。');
    return { age: (+date - +last.date) / DAY, angle: A.MoonPhase(date), fraction: A.Illumination(A.Body.Moon, date).phase_fraction };
  }
  function position(body, date, observer) {
    const eq = A.Equator(body, date, observer, true, false);
    return { eq, ...A.Horizon(date, observer, eq.ra, eq.dec, 'normal') };
  }
  function sky(date, latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new Error('緯度は−90〜90、経度は−180〜180で指定してください。');
    const observer = new A.Observer(latitude, longitude, 0);
    const moon = position(A.Body.Moon, date, observer), sun = position(A.Body.Sun, date, observer);
    const h = A.Horizon(date, observer, moon.eq.ra, moon.eq.dec, false);
    let rotation = A.Rotation_EQD_HOR(date, observer);
    rotation = A.Pivot(rotation, 2, h.azimuth);
    rotation = A.Pivot(rotation, 1, h.altitude);
    const v = A.RotateVector(rotation, sun.eq.vec);
    // Camera frame: y points left, z points up. Canvas x right, y down.
    const tilt = Math.atan2(-v.z, -v.y);
    return { moon, sun, tilt, observer, ...phase(date) };
  }
  function dayStart(day, zone) {
    // Some zones advance their clocks at midnight. Use the first existing local minute.
    for (let minute=0; minute<=180; minute++) {
      const clock=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
      try { return localTime(day, clock, zone, true).date; }
      catch(error) { if(error instanceof RangeError) throw error; }
    }
    throw new Error('この地域には、この日付の開始時刻がありません。別の日付を選んでください。');
  }
  function riseSet(day, zone, observer) {
    const start = dayStart(day, zone);
    // DST and date-line changes can shorten a day or skip an entire local date.
    let end;
    for(let n=1;n<=3&&!end;n++) { try { end=dayStart(shiftDay(day,n),zone); } catch(error) { if(error instanceof RangeError)throw error; } }
    if(!end)throw new Error('翌日の開始時刻を計算できませんでした。');
    const output = {};
    for (const [key,body,direction] of [['moonrise',A.Body.Moon,1],['moonset',A.Body.Moon,-1],['sunrise',A.Body.Sun,1],['sunset',A.Body.Sun,-1]]) {
      const event = A.SearchRiseSet(body, observer, direction, start, (+end-+start)/DAY);
      output[key] = event && +event.date < +end ? event.date : null;
    }
    return output;
  }
  function quarters(start, end) {
    const result = []; let q = A.SearchMoonQuarter(start);
    while (+q.time.date < +end) { result.push({ quarter:q.quarter, date:q.time.date }); q=A.NextMoonQuarter(q); }
    return result;
  }
  const api = { parts,dateText,timeText,localTime,shiftDay,phase,sky,riseSet,quarters };
  if (typeof module === 'object') module.exports = api; else root.MoonAstro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
