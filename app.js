import { configured, createStore } from './store.js';
import { validateRoom, rankTrips, escapeHtml as h, todayLocal, formatDate, durationLabel } from './core.js';
const app = document.querySelector('#app'), mode = document.querySelector('#mode');
let store, demo=false, room, members=[], selected=new Set(), draftName='', dirty=false, unsubscribe, activeId='', onlineData=true, routeVersion=0;
let toastTimer;
function toast(text) { const el=document.querySelector('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),5000); }
function errorText(e) {
  console.error(e);
  const code=e.code || '';
  if(code.includes('permission-denied')) return '접근 권한이 없어요. 방이 존재하는지, Firestore 보안 규칙이 적용됐는지 확인해주세요.';
  if(code.includes('operation-not-allowed') || code.includes('admin-restricted')) return 'Firebase Authentication에서 익명 로그인을 활성화해주세요.';
  if(code.includes('quota') || code.includes('resource-exhausted')) return '무료 사용 한도에 도달했어요. 잠시 후 다시 시도해주세요.';
  if(code.includes('network') || code.includes('unavailable')) return '인터넷 연결을 확인한 뒤 다시 시도해주세요.';
  return e.message || '요청을 처리하지 못했어요. 다시 시도해주세요.';
}
async function action(button, fn) {
  button.disabled=true;
  try { await fn(); } catch(e) { toast(errorText(e)); }
  finally { if(button.isConnected) button.disabled=false; }
}
const note = () => demo ? '<div class="notice">체험 모드 · 이 브라우저에만 저장돼요. 친구와 공유하려면 Firebase를 연결해주세요.</div>' : '';
function home() {
  app.innerHTML=`${note()}<section class="hero"><div><span class="eyebrow">LET’S MAKE IT HAPPEN</span><h1>“언제 갈까?”를<br><span>“이날 떠나자!”로.</span></h1><p>가능한 날짜만 모으면, 함께 떠날 날이 보여요.<br>우리의 다음 여행, 여기서 시작해요.</p><div class="steps"><span>01 방 만들기</span><span>02 날짜 모으기</span><span>03 함께 떠나기</span></div></div><div class="ticket" aria-hidden="true"><div class="ticket-top">OUR NEXT TRIP <span>✦</span></div><div class="ticket-title">함께라서<br>더 좋은 날</div><div class="ticket-calendar"><span>FRI</span><span>SAT</span><span>SUN</span><b>18</b><b>19</b><b>20</b></div><div class="ticket-bottom">DESTINATION <strong>우리 모두 가능한 날</strong></div></div></section>
  <section class="home-grid"><form id="create-form" class="card"><div class="section-heading"><span class="mini-icon">＋</span><div><h2>새 여행 만들기</h2><p>친구들과 살펴볼 후보 기간을 정해주세요.</p></div></div>
  <label>여행 이름<input name="title" maxlength="60" placeholder="예: 우리들의 제주 여행" required></label>
  <div class="field-row"><label>후보 시작일<input name="start" type="date" value="${todayLocal()}" required></label><label>후보 마지막 날<input name="end" type="date" value="${todayLocal()}" required></label></div>
  <div class="field-row"><label>여행 일정<select name="tripDays">${Array.from({length:14},(_,i)=>`<option value="${i+1}">${durationLabel(i+1)}</option>`).join('')}</select></label><label>예정 인원 (나 포함)<input name="expected" type="number" min="2" max="30" value="4" required></label></div>
  <p class="hint">후보 기간은 최대 120일 · 인원은 2~30명</p><button class="primary wide" type="submit">${demo?'체험 여행 방 만들기':'여행 방 만들기'}</button></form>
  <aside class="side-note"><span class="eyebrow">A LITTLE LESS PLANNING</span><h2>단톡방 스크롤은 줄이고,<br>여행의 설렘은 더하고.</h2><ul><li><strong>링크 하나로 초대</strong><p>친구들은 닉네임과 가능한 날짜만 입력하면 돼요.</p></li><li><strong>연속된 날짜까지 한 번에</strong><p>여행 내내 함께할 수 있는 사람을 계산해요.</p></li><li><strong>응답은 언제든 수정</strong><p>날짜 확정 전까지 같은 브라우저에서 바꿀 수 있어요.</p></li></ul></aside></section>
  ${!configured?'<section class="setup card"><h2>친구들과 사용하려면</h2><p>지금은 체험 모드예요. Firebase 무료 프로젝트를 만든 후 설정값과 보안 규칙을 연결하면 실제 공유가 시작됩니다.</p><a href="./DEPLOY.html" target="_blank" rel="noopener">Firebase 연결·GitHub Pages 배포 안내 보기</a></section>':''}`;
  document.querySelector('#create-form').onsubmit=e=>{ e.preventDefault(); const f=e.currentTarget; action(f.querySelector('button'),async()=>{
    const input=Object.fromEntries(new FormData(f)), data=validateRoom(input);
    const id=await store.create(data); location.hash=`${demo?'demo/':'room/'}${id}`;
  }); };
}
function calendarMarkup() {
  const months=Map.groupBy ? Map.groupBy(room.dates,d=>d.slice(0,7)) : room.dates.reduce((a,d)=>{const k=d.slice(0,7); a.set(k,[...(a.get(k)||[]),d]);return a;},new Map());
  return [...months].map(([month,dates])=>{
    const first=new Date(dates[0]+'T00:00:00Z').getUTCDay();
    return `<section class="month"><h3>${month.slice(0,4)}년 ${Number(month.slice(5))}월</h3><div class="calendar"><div class="weekday">일</div><div class="weekday">월</div><div class="weekday">화</div><div class="weekday">수</div><div class="weekday">목</div><div class="weekday">금</div><div class="weekday">토</div>${'<span></span>'.repeat(first)}${dates.map(d=>`<button type="button" class="day ${selected.has(d)?'selected':''}" data-date="${d}" aria-label="${formatDate(d)}" aria-pressed="${selected.has(d)}" ${room.finalStart?'disabled':''}>${Number(d.slice(8))}</button>`).join('')}</div></section>`;
  }).join('');
}
function renderRoom() {
  if(!room) return;
  const isOwner=room.owner===store.uid, mine=members.find(m=>m.uid===store.uid), results=rankTrips(room,members);
  const final=results.find(r=>r.start===room.finalStart);
  app.innerHTML=`${note()}<a class="back" href="#">모든 여행 시작 화면</a><section class="room-heading"><div><span class="eyebrow">OUR NEXT TRIP</span><h1>${h(room.title)}</h1><p>${formatDate(room.dates[0])} ~ ${formatDate(room.dates.at(-1))} <span class="separator">/</span> ${durationLabel(room.tripDays)}</p></div><button class="secondary" id="share" ${demo?'disabled':''}>초대 링크 복사</button></section>
  <div class="stats"><span><strong>${members.length}</strong>명 응답 / 예정 ${room.expected}명</span><span>${room.finalStart?'일정 확정':`아직 ${Math.max(0,room.expected-members.length)}명의 응답을 기다려요`}</span><span id="connection">${onlineData?'':'연결 확인 중 · 저장된 결과일 수 있어요'}</span></div>
  ${final?`<section class="final-banner"><span>✦ 우리의 여행 날짜가 정해졌어요</span><h2>${formatDate(final.start)}${room.tripDays>1?' ~ '+formatDate(final.end):''}</h2><p>${durationLabel(room.tripDays)} · ${final.count}명 참여 가능</p>${isOwner?'<button id="reopen" class="secondary">확정 취소하고 응답 다시 받기</button>':''}</section>`:''}
  <div class="workspace"><section class="card vote-card"><div class="section-heading"><span class="mini-icon">✓</span><div><h2>나는 이날 가능해요</h2><p>출발일부터 돌아오는 날까지 모두 선택해주세요.</p></div></div>
  <form id="vote-form"><label>내 닉네임<input id="nickname" maxlength="20" required value="${h(draftName)}" placeholder="친구들이 알아볼 이름" ${room.finalStart?'disabled':''}></label>
  <div class="calendar-toolbar"><span><i></i> 선택한 날짜 <b id="selected-count">${selected.size}</b>일</span><div><button type="button" class="text-button" id="select-all" ${room.finalStart?'disabled':''}>전체 선택</button><button type="button" class="text-button" id="clear-all" ${room.finalStart?'disabled':''}>초기화</button></div></div>
  <div class="months">${calendarMarkup()}</div><div class="save-area"><p class="hint" id="save-status">${dirty?'변경한 내용을 저장해주세요.':mine?'저장된 응답을 보고 있어요.':'날짜를 선택하지 않고 저장하면 가능한 날 없음으로 응답해요.'}</p><button type="submit" class="primary wide" ${room.finalStart?'disabled':''}>${room.finalStart?'확정된 일정이에요':mine?'내 응답 수정하기':'내 응답 저장하기'}</button>${mine&&!room.finalStart?'<button type="button" class="text-button remove" id="remove-vote">내 응답 삭제</button>':''}<p class="hint">이 브라우저에서 내 응답을 수정할 수 있어요. 브라우저 데이터를 지우거나 다른 기기를 사용하면 새 참가자로 인식돼요.</p></div></form></section>
  <aside class="results-column"><section class="card"><div class="section-heading"><span class="mini-icon orange">✦</span><div><h2>함께 떠나기 좋은 날</h2><p>여행 전체 기간에 가능한 인원순이에요.</p></div></div><div id="results">${members.length?results.slice(0,5).map((r,i)=>`<article class="result ${i===0?'best':''}"><div class="result-top"><span class="result-label">${r.everyone?'전원 가능':i===0?'가장 많이 모이는 날':`후보 ${i+1}`}</span><strong>${r.count}<small> / ${Math.max(room.expected,members.length)}명</small></strong></div><h3>${formatDate(r.start)}${room.tripDays>1?`<br><span>~ ${formatDate(r.end)}</span>`:''}</h3><p>${r.available.length?r.available.map(m=>h(m.name)).join(', '):'전체 기간이 가능한 사람이 아직 없어요.'}</p>${isOwner&&!room.finalStart?`<button class="${i===0?'primary':'secondary'} wide" data-final="${r.start}" ${!r.count||!onlineData?'disabled':''}>이 날짜로 확정</button>`:''}</article>`).join(''):'<div class="empty"><span>☀</span><h3>첫 번째 응답을 기다려요</h3><p>내 날짜를 저장하면<br>여행 후보 일정이 나타나요.</p></div>'}</div>${members.length?'<p class="hint">아직 응답하지 않은 사람의 가능 여부는 알 수 없어요. 같은 인원수면 빠른 날짜를 먼저 보여줘요.</p>':''}</section>
  <section class="card"><h2>우리의 응답 <span class="count">${members.length}</span></h2><div class="member-list">${members.map((m,i)=>`<div class="member"><span class="avatar color-${i%3}">${h(m.name.slice(0,1))}</span><span><strong>${h(m.name)} ${m.uid===store.uid?'<small>나</small>':''}</strong><small>${m.dates.length?`${m.dates.length}일 가능`:'가능한 날 없음'}</small></span><span class="check">✓</span></div>`).join('')||'<p class="hint">초대 링크를 친구들에게 보내보세요.</p>'}</div></section></aside></div>`;
  bindRoom();
}
function updateSelection() {
  dirty=true;
  document.querySelectorAll('[data-date]').forEach(b=>{ const yes=selected.has(b.dataset.date); b.classList.toggle('selected',yes); b.setAttribute('aria-pressed',yes); });
  document.querySelector('#selected-count').textContent=selected.size;
  document.querySelector('#save-status').textContent='변경한 내용을 저장해주세요.';
}
function bindRoom() {
  document.querySelector('#nickname').oninput=e=>{draftName=e.target.value; dirty=true; document.querySelector('#save-status').textContent='변경한 내용을 저장해주세요.';};
  document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selected.has(b.dataset.date)?selected.delete(b.dataset.date):selected.add(b.dataset.date);updateSelection();});
  document.querySelector('#select-all').onclick=()=>{selected=new Set(room.dates);updateSelection();};
  document.querySelector('#clear-all').onclick=()=>{selected.clear();updateSelection();};
  document.querySelector('#share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('초대 링크를 복사했어요. 친구들에게 보내주세요!');}catch{window.prompt('아래 초대 링크를 복사해주세요.',location.href);}};
  document.querySelector('#vote-form').onsubmit=e=>{ e.preventDefault(); const name=draftName.trim(); if(!name) return toast('닉네임을 입력해주세요.'); const dates=[...selected].sort(); const id=activeId; action(e.currentTarget.querySelector('[type=submit]'),async()=>{
    await store.save(id,name,dates); if(id!==activeId)return; dirty=false; draftName=name; toast('내 응답을 저장했어요.');renderRoom();
  }); };
  document.querySelectorAll('[data-final]').forEach(b=>b.onclick=()=>{if(!confirm(`${formatDate(b.dataset.final)} 출발로 확정할까요? 확정 후에는 응답 수정이 잠겨요.`))return;action(b,()=>store.finalize(activeId,b.dataset.final));});
  const reopen=document.querySelector('#reopen'); if(reopen) reopen.onclick=()=>action(reopen,()=>store.finalize(activeId,''));
  const remove=document.querySelector('#remove-vote'); if(remove) remove.onclick=()=>{if(!confirm('내 응답을 삭제할까요?'))return;action(remove,async()=>{await store.removeVote(activeId);dirty=false;selected.clear();renderRoom();toast('내 응답을 삭제했어요.');});};
}
async function route() {
  const version=++routeVersion;
  unsubscribe?.(); unsubscribe=null; activeId=''; room=null; members=[]; dirty=false; selected.clear();draftName='';
  const hash=location.hash.slice(1), match=/^(room|demo)\/([A-Za-z0-9-]{8,80})$/.exec(hash);
  demo=match?match[1]==='demo':!configured;
  mode.textContent=demo?'체험 모드':'친구들과 함께';
  app.setAttribute('aria-busy','true'); app.innerHTML='<p class="loading">여행 준비 중…</p>';
  try {
    if(hash&&!match) throw new Error('초대 링크 형식이 올바르지 않아요. 친구에게 링크를 다시 받아주세요.');
    store=await createStore(demo); if(version!==routeVersion)return;
    if(!match){home();return;}
    activeId=match[2];
    let initialized=false;
    unsubscribe=store.watch(activeId,r=>{
      if(version!==routeVersion)return;
      if(!r){room=null;app.innerHTML='<section class="card empty"><h1>여행 방을 찾지 못했어요</h1><p>초대 링크를 확인해주세요. 체험 방은 만든 브라우저에서만 열 수 있어요.</p><a href="#">시작 화면으로</a></section>';return;}
      room=r;renderRoom();
    },(list,fromCache)=>{
      if(version!==routeVersion)return;
      onlineData=!fromCache;members=list;
      const mine=members.find(m=>m.uid===store.uid);
      if(!dirty){selected=new Set(mine?.dates||[]);draftName=mine?.name||'';}
      // Preserve keyboard focus and unsaved input while other participants update.
      const focused=document.activeElement, focusId=focused?.id, focusedDate=focused?.dataset?.date;
      const caret=focused?.tagName==='INPUT'&&focused.type==='text'?focused.selectionStart:null;
      renderRoom();
      const target=focusId?document.getElementById(focusId):focusedDate?document.querySelector(`[data-date="${focusedDate}"]`):null;
      if(initialized&&target){target.focus({preventScroll:true});if(caret!==null)target.setSelectionRange(caret,caret);}
      initialized=true;
    },e=>{if(version===routeVersion)toast(errorText(e));});
  } catch(e) { if(version===routeVersion)app.innerHTML=`<section class="card empty"><h1>연결을 확인해주세요</h1><p>${h(errorText(e))}</p><a href="#">시작 화면으로</a> · <a href="./DEPLOY.html">설정 안내</a></section>`; }
  finally { if(version===routeVersion)app.setAttribute('aria-busy','false'); }
}
window.addEventListener('hashchange',route);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('offline',()=>toast('인터넷 연결이 끊겼어요. 저장 완료 메시지를 확인해주세요.'));
route();
