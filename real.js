'use strict';
(() => {
  const C = MoonAstro;
  const cities = {
    tokyo:[35.6812,139.7671,'Asia/Tokyo'], sapporo:[43.0618,141.3545,'Asia/Tokyo'],
    aomori:[40.8222,140.7474,'Asia/Tokyo'], osaka:[34.6937,135.5023,'Asia/Tokyo'],
    naha:[26.2124,127.6809,'Asia/Tokyo'], sydney:[-33.8688,151.2093,'Australia/Sydney'],
    london:[51.5074,-.1278,'Europe/London'], newyork:[40.7128,-74.006,'America/New_York']
  };
  let calendarMonth = '', calendarKey = '';
  const quarterNames = ['新月','上弦','満月','下弦'];
  function showError(error) {
    $('realError').textContent = error instanceof RangeError ? 'タイムゾーンを確認してください（例：Asia/Tokyo）。' : String(error.message || error);
    $('realError').hidden = false; $('realResults').hidden = true;
  }
  function drawMoon(canvas, fraction, rotation) {
    const ctx=canvas.getContext('2d');ctx.fillStyle='#101e35';ctx.fillRect(0,0,canvas.width,canvas.height);
    moon(ctx,canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*.32,Math.acos(Math.max(-1,Math.min(1,1-2*fraction))),rotation);
    return ctx;
  }
  function drawSky(g) {
    const canvas=$('realSky'),ctx=canvas.getContext('2d'),base=285;
    const grad=ctx.createLinearGradient(0,0,0,base);grad.addColorStop(0,g.sun.altitude>0?'#347bb7':'#101e35');grad.addColorStop(1,g.sun.altitude>-10?'#c0bfc3':'#405477');ctx.fillStyle=grad;ctx.fillRect(0,0,1000,360);
    ctx.fillStyle='#263f46';ctx.fillRect(0,base,1000,75);
    for (const alt of [0,30,60,90]) { const y=base-alt/90*235;ctx.beginPath();ctx.moveTo(50,y);ctx.lineTo(950,y);ctx.strokeStyle='#cad8e955';ctx.stroke();label(ctx,`${alt}°`,27,y+5,'#f1f5f8',13); }
    ['北','東','南','西','北'].forEach((s,i)=>label(ctx,s,50+i*225,333,'#f2f5f2',20));
    for(const [body,name] of [[g.sun,'太陽'],[g.moon,'月']]) {
      if(body.altitude<0) continue;
      const x=50+body.azimuth/360*900,y=base-body.altitude/90*235;
      if(name==='太陽')circle(ctx,x,y,16,'#ffcf6a');else moon(ctx,x,y,20,Math.acos(1-2*g.fraction),g.tilt);
      label(ctx,name,x,Math.max(22,y-29),'#fff7df',16);
    }
  }
  function fact(term,value) {
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=term;dd.textContent=value;$('realFacts').append(dt,dd);
  }
  function calendar(zone,selectedDay) {
    const key=`${calendarMonth}|${zone}`;
    if(calendarKey===key) {
      for(const b of $('calendar').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.date===selectedDay));
      return;
    }
    const [year,month]=calendarMonth.split('-').map(Number);
    const days=new Date(Date.UTC(year,month,0)).getUTCDate();
    const first=`${calendarMonth}-01`;
    const endMonth=month===12?`${year+1}-01-01`:`${year}-${String(month+1).padStart(2,'0')}-01`;
    const start=C.localTime(first,'12:00',zone).date;
    // Search an extra day on each side, then assign each event by its local date.
    const events=C.quarters(new Date(+start-86400000),new Date(`${endMonth}T23:59Z`)).filter(q=>C.dateText(q.date,zone).startsWith(calendarMonth));
    $('calendarTitle').textContent=`${year}年 ${month}月`;
    $('calendar').replaceChildren();
    for(let i=0;i<new Date(`${first}T12:00Z`).getUTCDay();i++)$('calendar').append(document.createElement('span'));
    for(let day=1;day<=days;day++) {
      const ds=`${calendarMonth}-${String(day).padStart(2,'0')}`;
      const b=document.createElement('button');b.type='button';b.dataset.date=ds;b.setAttribute('aria-pressed',String(ds===selectedDay));
      const num=document.createElement('span');num.className='calday';num.textContent=day;b.append(num);
      try {
        const p=C.phase(C.localTime(ds,'12:00',zone).date);
        const cv=document.createElement('canvas');cv.width=64;cv.height=54;cv.setAttribute('aria-hidden','true');b.append(cv);
        // Ecliptic phase indicates waxing/waning; small icons deliberately have no horizon tilt.
        drawMoon(cv,p.fraction,p.angle>180?Math.PI:0);
        const age=document.createElement('span');age.className='calage';age.textContent=p.age.toFixed(1);b.append(age);
        const ev=events.find(q=>C.dateText(q.date,zone)===ds);
        if(ev){const text=document.createElement('span');text.className='calevent';text.textContent=quarterNames[ev.quarter];b.append(text);}
        b.setAttribute('aria-label',`${month}月${day}日 正午の月齢${p.age.toFixed(1)}${ev?' '+quarterNames[ev.quarter]:''}`);
        b.addEventListener('click',()=>{$('realDate').value=ds;update();});
      } catch { b.disabled=true;b.setAttribute('aria-label',`${month}月${day}日 この地域には存在しない日付です`); }
      $('calendar').append(b);
    }
    $('quarterEvents').textContent=events.map(q=>`${quarterNames[q.quarter]}：${+C.parts(q.date,zone).day}日 ${C.timeText(q.date,zone)}`).join(' ／ ');
    $('prevMonth').disabled=calendarMonth==='1900-01';$('nextMonth').disabled=calendarMonth==='2100-12';calendarKey=key;
  }
  function update() {
    try {
      if(!$('realForm').checkValidity())throw new Error('日付・時こく・緯度・経度の入力を確認してください。');
      const day=$('realDate').value,zone=$('zone').value.trim();
      const resolved=C.localTime(day,$('realTime').value,zone),date=resolved.date;
      const lat=Number($('latitude').value),lon=Number($('longitude').value),g=C.sky(date,lat,lon);
      const events=C.riseSet(day,zone,g.observer);
      const offset=new Intl.DateTimeFormat('ja-JP',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName').value;
      $('realStamp').textContent=`${day} ${C.timeText(date,zone)}（${zone}・${offset}） 緯度 ${lat}°／経度 ${lon}°${resolved.ambiguous?' ※夏時間終了で重なる時こくのうち、先の時刻を表示。':''}`;
      const ctx=drawMoon($('realMoon'),g.fraction,g.tilt);label(ctx,'天頂の方向 ↑',210,27,'#a7bcd3',14);
      $('realName').textContent=phaseName(g.angle*Math.PI/180);
      $('realNumbers').textContent=`月齢 ${g.age.toFixed(2)} ／ 明るい割合 ${(g.fraction*100).toFixed(1)}%`;
      $('realMoon').setAttribute('aria-label',`${$('realName').textContent}、月齢${g.age.toFixed(2)}、明るい割合${(g.fraction*100).toFixed(1)}パーセント。上は天頂方向。`);
      $('realVisibility').textContent=g.moon.altitude<0?'月の中心は地平線の下です。':g.fraction<.01?'月は地平線より上ですが、新月付近で見つけるのは困難です。':`月は地平線より上です。${g.sun.altitude>0?'太陽も出ています。昼間の月を探すときも太陽を直接見ないでください。':'雲や周りの建物にも気をつけて探してみましょう。'}`;
      $('realFacts').replaceChildren();
      const direction=['北','北東','東','南東','南','南西','西','北西'][Math.round(g.moon.azimuth/45)%8];
      fact('月の方角',`${direction}（方位角 ${g.moon.azimuth.toFixed(1)}°）`);fact('月の高さ',`高度 ${g.moon.altitude.toFixed(1)}°`);
      for(const [key,name] of [['moonrise','月の出'],['moonset','月の入り'],['sunrise','日の出'],['sunset','日の入り']])fact(name,events[key]?C.timeText(events[key],zone):'この日はありません');
      drawSky(g);$('realSky').setAttribute('aria-label',`月：方位角${g.moon.azimuth.toFixed(1)}度、高度${g.moon.altitude.toFixed(1)}度。太陽：方位角${g.sun.azimuth.toFixed(1)}度、高度${g.sun.altitude.toFixed(1)}度。`);
      if(!calendarMonth)calendarMonth=day.slice(0,7);
      calendar(zone,day);$('realError').hidden=true;$('realResults').hidden=false;
    }catch(error){showError(error);}
  }
  function setNow() {try{const now=new Date(),zone=$('zone').value.trim();$('realDate').value=C.dateText(now,zone);$('realTime').value=C.timeText(now,zone);calendarMonth=$('realDate').value.slice(0,7);update();}catch(e){showError(e);}}
  $('learnButton').addEventListener('click',()=>{$('learningMode').hidden=false;$('realMode').hidden=true;$('learnButton').setAttribute('aria-pressed','true');$('realButton').setAttribute('aria-pressed','false');});
  $('realButton').addEventListener('click',()=>{stop();render();$('learningMode').hidden=true;$('realMode').hidden=false;$('learnButton').setAttribute('aria-pressed','false');$('realButton').setAttribute('aria-pressed','true');update();});
  $('realForm').addEventListener('submit',e=>{e.preventDefault();calendarMonth=$('realDate').value.slice(0,7);update();});
  $('city').addEventListener('change',()=>{const city=cities[$('city').value];if(city){[$('latitude').value,$('longitude').value,$('zone').value]=city;update();}});
  for(const id of ['latitude','longitude'])$(id).addEventListener('change',()=>{$('city').value='custom';update();});
  for(const id of ['realDate','realTime','zone'])$(id).addEventListener('change',()=>{calendarMonth=$('realDate').value.slice(0,7);update();});
  $('nowButton').addEventListener('click',setNow);
  for(const [id,delta] of [['prevDay',-1],['nextDay',1]])$(id).addEventListener('click',()=>{try{const day=C.shiftDay($('realDate').value,delta);if(day<'1900-01-01'||day>'2100-12-31')throw new Error('対応期間は1900〜2100年です。');$('realDate').value=day;calendarMonth=day.slice(0,7);update();}catch(e){showError(e);}});
  for(const [id,delta] of [['prevMonth',-1],['nextMonth',1]])$(id).addEventListener('click',()=>{const [y,m]=calendarMonth.split('-').map(Number);calendarMonth=new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);try{calendar($('zone').value.trim(),$('realDate').value);}catch(e){showError(e);}});
  // Start at today's date, at the same 18:00 observation time as the teaching model.
  $('realDate').value=C.dateText(new Date(),'Asia/Tokyo');
})();
