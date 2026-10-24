const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=window.FINAL_ROUND_API||'',hostPage=document.body.dataset.mode==='host',base=new URL(document.body.dataset.base,location.href),playerURL=new URL('audi/',base).href,hostURL=new URL('audi/host/',base).href;
let room='',player='',hostKey='',hosting=false,poll=null,lobbyPoll=null,last='',state=null,offset=0,busy=false,answering=false,retries=0,roundWake=null,epoch=0,template=null,active=null,draftQuestions=[],launchId=null;
const show=id=>['landing','host','game'].forEach(s=>$(s).hidden=s!==id);
const safe=fn=>async ev=>{ev?.preventDefault();try{await fn(ev);}catch(e){error(e);}};
function error(e){$('errorText').textContent=e.message||String(e);$('error').hidden=false;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,2500);}
$('dismissError').onclick=()=>$('error').hidden=true;
function stop(){epoch++;clearTimeout(poll);clearTimeout(roundWake);clearTimeout(lobbyPoll);}
function remember(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}
function recalled(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
async function send(path,body={},auth=false){
  const res=await fetch(api.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${hostKey}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'Connection failed.'),{status:res.status});return data;
}
const request=(action,body={})=>send(`/room/${room}/${action}`,{...body,...(!hosting&&player?{player}:{})},hosting);
const series=(action,body={})=>send(`/quiz/audi/${action}`,body,action!=='status');
const invite=new URLSearchParams(location.hash.slice(1));
const invitedRoom=/^[A-Z0-9]{6}$/.test(invite.get('room')||'')?invite.get('room'):'';
if(/^[A-F0-9]{12}$/.test(invite.get('code')||''))$('entry').value=invite.get('code');
function invitation(code){const url=new URL(playerURL);url.hash=new URLSearchParams({room,code}).toString();return url.href;}
async function copy(value){await navigator.clipboard.writeText(value);toast('Copied to clipboard.');}
async function lobbyStatus(){
  clearTimeout(lobbyPoll);if(hostPage||!$('game').hidden)return;
  try{
    const s=await series('status'),a=s.active;
    if(invitedRoom){$('pin').value=invitedRoom;$('lobbyBadge').textContent='Personal invitation';$('lobbyMessage').textContent='Your invitation is ready. Add your name and Discord username to join.';$('joinButton').disabled=false;}
    else if(a?.phase==='lobby'){$('pin').value=a.room;$('lobbyBadge').textContent='Lobby open';$('lobbyMessage').textContent=`Audi’s lobby is open · ${a.players} joined. Enter your personal invitation code below.`;$('joinButton').disabled=false;}
    else{$('pin').value='';$('joinButton').disabled=true;$('lobbyBadge').textContent=!a||a.phase==='finished'?'Opening soon':'Game in progress';$('lobbyMessage').textContent=!a||a.phase==='finished'?'Audi hasn’t opened the next lobby yet. Keep this page open; it updates automatically.':'The current game has started. The next lobby will appear here when Audi opens it.';}
  }catch(e){if(invitedRoom){$('pin').value=invitedRoom;$('joinButton').disabled=false;$('lobbyBadge').textContent='Personal invitation';$('lobbyMessage').textContent='Enter your details to join your invitation’s room.';}else{$('joinButton').disabled=true;$('lobbyBadge').textContent='Reconnecting';$('lobbyMessage').textContent='We couldn’t reach the lobby. We’ll keep trying, or use Refresh below.';}}
  lobbyPoll=setTimeout(lobbyStatus,12000);
}
$('retryLobby').onclick=lobbyStatus;
$('hostToggle').onclick=()=>{if(hostPage){stop();show('host');if(hostKey)loadDesk().catch(error);}else location.href=hostURL;};
$('back').onclick=()=>location.href=playerURL;
$('playerLink').value=playerURL;$('hostLink').value=hostURL;
$('copyPlayerLink').onclick=safe(()=>copy(playerURL));$('copyHostLink').onclick=safe(()=>copy(hostURL));
$('unlockForm').onsubmit=safe(async()=>{hostKey=$('hostKey').value;hosting=true;$('unlock').disabled=true;try{await loadDesk();$('hostKey').value='';}catch(e){hostKey='';hosting=false;throw e;}finally{$('unlock').disabled=false;}});
async function loadDesk(){
  const data=await series('load');template=data.template;active=data.active;
  draftQuestions=template?structuredClone(template.questions):[];
  $('eventTitle').value=template?.title||'Audi’s After Hours';
  $('savedSummary').textContent=template?`${template.questions.length} questions · ${new Set(template.questions.map(q=>q.section).filter(Boolean)).size} sections · double-points finale`:'Import your private question file once, then save it here.';
  $('savedBadge').textContent=template?'Saved privately':'Setup needed';$('launch').disabled=!template;
  $('activeSummary').textContent=active?`Current game: ${active.room} · ${active.phase==='lobby'?'Lobby open':active.phase==='finished'?'Finished':'In progress'} · ${active.players} players`:'No lobby open yet. Your public player link is ready to share.';
  $('resume').hidden=!active;$('hostLogin').hidden=true;$('hostDashboard').hidden=false;show('host');drawEditor();
  if(!template)$('editorDetails').open=true;
}
$('lockHost').onclick=()=>{stop();hostKey='';hosting=false;template=null;draftQuestions=[];$('questionEditor').innerHTML='';$('questionJSON').value='';$('gameBody').innerHTML='';state=null;$('hostKey').value='';$('hostDashboard').hidden=true;$('hostLogin').hidden=false;toast('Host desk locked.');};
async function launch(practice,replace){
  if(busy)return;busy=true;$('launch').disabled=true;$('practice').disabled=true;
  launchId??=crypto.randomUUID();
  try{const data=await series(practice?'practice':'launch',{requestId:launchId,...(replace?{replace}:{})});room=data.room;launchId=null;hosting=true;player='';start();}
  finally{busy=false;$('launch').disabled=!template;$('practice').disabled=false;}
}
$('launch').onclick=safe(async()=>{const latest=await series('load');active=latest.active;if(active&&active.phase!=='finished')$('confirmDialog').showModal();else await launch(false);});
$('confirmNew').onclick=safe(async()=>{$('confirmDialog').close();await launch(false,active?.room);});
$('cancelNew').onclick=()=>$('confirmDialog').close();
$('practice').onclick=safe(()=>launch(true));
$('resume').onclick=safe(async()=>{if(!active)return;room=active.room;hosting=true;player='';start();});
$('exitGame').onclick=safe(async()=>{stop();if(hosting){show('host');await loadDesk();}else{show('landing');lobbyStatus();}});
function validateDraft(qs){if(!Array.isArray(qs)||qs.length<2||qs.length>50)throw Error('Use between 2 and 50 questions.');for(const [i,q]of qs.entries()){if(!q||typeof q.text!=='string'||!q.text.trim()||q.text.length>300||!Array.isArray(q.answers)||q.answers.length!==4||q.answers.some(a=>typeof a!=='string'||!a.trim()||a.length>150)||!Number.isInteger(q.correct)||q.correct<0||q.correct>3||!Number.isInteger(q.seconds)||q.seconds<5||q.seconds>60||(q.section!==undefined&&(typeof q.section!=='string'||!q.section.trim()||q.section.length>60)))throw Error(`Complete question ${i+1}: text, four choices, one correct answer, a section and a 5–60 second timer.`);}}
function drawEditor(){
  $('questionCount').textContent=`${draftQuestions.length} questions · answers visible only here`;
  $('questionEditor').innerHTML=draftQuestions.map((q,i)=>`<article class="question-edit"><div class="qheading"><strong>Question ${String(i+1).padStart(2,'0')}${i===draftQuestions.length-1?'<span class="qtag">2× FINALE</span>':''}</strong><button class="qremove" data-delete="${i}" aria-label="Remove question ${i+1}">×</button></div><label for="qt${i}">Question</label><textarea id="qt${i}" data-qtext="${i}" rows="2" maxlength="300">${esc(q.text)}</textarea><div class="qanswers">${q.answers.map((a,j)=>`<div class="qanswer"><input type="radio" name="correct${i}" data-qcorrect="${i}" value="${j}" ${q.correct===j?'checked':''} aria-label="Mark answer ${j+1} correct for question ${i+1}"><input type="text" data-qanswer="${i}:${j}" maxlength="150" value="${esc(a)}" aria-label="Question ${i+1} answer ${j+1}"></div>`).join('')}</div><div class="qfooter"><label>Section<input data-qsection="${i}" value="${esc(q.section||'The quiz')}" maxlength="60" aria-label="Question ${i+1} section"></label><label>Time limit<select data-qtime="${i}" aria-label="Question ${i+1} time limit">${[5,10,15,20,30,45,60].map(t=>`<option ${q.seconds===t?'selected':''}>${t}</option>`).join('')}</select></label><span>Mark the circle beside the correct answer.</span></div></article>`).join('');
  document.querySelectorAll('[data-qtext]').forEach(el=>el.oninput=()=>draftQuestions[el.dataset.qtext].text=el.value);
  document.querySelectorAll('[data-qanswer]').forEach(el=>el.oninput=()=>{const[i,j]=el.dataset.qanswer.split(':');draftQuestions[i].answers[j]=el.value;});
  document.querySelectorAll('[data-qcorrect]').forEach(el=>el.onchange=()=>draftQuestions[el.dataset.qcorrect].correct=Number(el.value));
  document.querySelectorAll('[data-qsection]').forEach(el=>el.oninput=()=>draftQuestions[el.dataset.qsection].section=el.value);
  document.querySelectorAll('[data-qtime]').forEach(el=>el.onchange=()=>draftQuestions[el.dataset.qtime].seconds=Number(el.value));
  document.querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>{if(draftQuestions.length<=2)return error(Error('Keep at least two questions.'));draftQuestions.splice(Number(el.dataset.delete),1);drawEditor();});
}
$('addQuestion').onclick=()=>{if(draftQuestions.length>=50)return error(Error('Maximum 50 questions.'));draftQuestions.push({section:draftQuestions.at(-1)?.section||'The quiz',text:'',answers:['','','',''],correct:0,seconds:20});drawEditor();};
$('importQuestions').onclick=()=>$('questionFile').click();
$('questionFile').onchange=safe(async()=>{const file=$('questionFile').files[0];if(!file)return;if(file.size>40000)throw Error('Use a file smaller than 40 KB.');const data=JSON.parse(await file.text());validateDraft(data);draftQuestions=data;drawEditor();$('questionFile').value='';toast('Loaded. Review and save your quiz.');});
$('pasteQuestions').onclick=()=>$('importDialog').showModal();$('cancelJSON').onclick=()=>$('importDialog').close();
$('applyJSON').onclick=safe(()=>{if($('questionJSON').value.length>40000)throw Error('Use a file smaller than 40 KB.');const data=JSON.parse($('questionJSON').value);validateDraft(data);draftQuestions=data;drawEditor();$('questionJSON').value='';$('importDialog').close();toast('Loaded. Review and save your quiz.');});
$('saveQuiz').onclick=safe(async()=>{validateDraft(draftQuestions);$('saveQuiz').disabled=true;try{await series('save',{title:$('eventTitle').value,questions:draftQuestions});await loadDesk();$('saveNotice').textContent='Saved privately. Ready for the next lobby.';toast('Your quiz is saved.');}finally{$('saveQuiz').disabled=false;}});
$('joinForm').onsubmit=safe(async()=>{hosting=false;room=$('pin').value;player='';if(!/^[A-Z0-9]{6}$/.test(room))throw Error('Wait for Audi to open a lobby.');$('joinButton').disabled=true;try{const r=await request('join',{name:$('name').value.trim(),discord:$('discord').value.trim(),entry:$('entry').value.trim().toUpperCase()});player=r.player;remember('audiCurrent',{room,player});remember('audiPlayer:'+room,{room,player});history.replaceState(null,'',location.pathname);start();}finally{$('joinButton').disabled=false;}});
function start(){stop();show('game');last='';state=null;retries=0;window.scrollTo({top:0,behavior:'instant'});refresh();}
async function refresh(){
  clearTimeout(poll);clearTimeout(roundWake);const run=epoch;
  try{const before=Date.now(),data=await request('state');if(run!==epoch)return;state=data;offset=state.now-(before+Date.now())/2;retries=0;$('connectionStatus').textContent='● Connected · answers saved on the server';render();if(state.phase==='question'&&!state.question&&state.started>Date.now()+offset)roundWake=setTimeout(refresh,Math.max(40,state.started-Date.now()-offset+40));}
  catch(e){if(run!==epoch)return;retries++;$('connectionStatus').textContent='Reconnecting… Keep this tab open.';if([401,403,404].includes(e.status)){error(e);return;}}
  poll=setTimeout(refresh,retries?Math.min(15000,2000*retries):2000);
}
function board(s){return `<div class="board">${(s.leaderboard||[]).slice(0,5).map((p,i)=>`<div class="rankrow"><span>${String(p.rank||i+1).padStart(2,'0')}</span><span>${esc(p.name)}${p.discord?`<small>${esc(p.discord)}</small>`:''}${p.tied?'<small>Exact tie · host review</small>':''}</span><strong>${p.score.toLocaleString()} pts</strong></div>`).join('')}</div>`;}
function controls(s){if(!hosting)return '';const approved=s.roster?.filter(p=>p.approved&&!p.removed).length||0;return `<div class="hostactions">${s.phase==='lobby'?'<button data-action="entries">Make 10 invitations</button>':''}${['lobby','reveal','section','final'].includes(s.phase)?`<button class="primary" data-action="next" ${s.phase==='lobby'&&!approved?'disabled':''}>${s.phase==='final'?'Start double-points finale ↗':s.phase==='section'?'Start this section ↗':s.index===s.total-1?'Show final top five ↗':s.phase==='lobby'?'Start quiz ↗':'Continue ↗'}</button>`:''}${s.phase==='question'?'<button data-action="close">Close answers & reveal</button>':''}${s.phase==='finished'?'<button data-action="export">Export results</button><button data-desk>Back to host desk ↗</button>':''}</div>${s.phase==='lobby'?`<p class="host-tip">${approved?'Ready when you are. Nothing starts until you press Start quiz.':'Make invitations, share one per person, and approve at least one player to start.'}</p>`:''}`;}
function render(){const s=state;if(!s)return;const signature=JSON.stringify(s,(k,v)=>k==='now'?undefined:v);if(signature===last)return;last=signature;document.dispatchEvent(new CustomEvent('quizphase',{detail:s.phase}));
  let html=`${s.practice?'<div class="practice-badge">PRACTICE GAME · Your real quiz and public lobby are unchanged.</div>':''}<div class="topline"><span>${esc(s.title)} · ROOM <b>${esc(room)}</b></span><span>${hosting?'HOST DESK':esc(s.me?.name)} · ${hosting?s.players+(s.players===1?' player':' players'):(s.me?.score||0).toLocaleString()+' pts'}</span></div>`;
  if(s.phase==='lobby'){const approved=s.roster?.filter(p=>p.approved&&!p.removed).length||0;
    html+=`<div class="center"><div class="eyebrow">THE GUEST LIST IS OPEN</div><h1>${hosting?'Your room. Your rules.':s.me?.approved?'You’re on the list.':'You’re in the lobby.'}</h1><p>${hosting?'Invite your people. Approve the list. Start when the room is ready.':s.me?.approved?'You’re approved. Stay here — Audi will start the quiz.':'Audi is checking your entry. This screen updates automatically.'}</p><div class="lobby-stats"><div><strong>${s.players}</strong><span>joined</span></div><div><strong>${hosting?approved:s.total}</strong><span>${hosting?'approved':'questions'}</span></div></div></div>`;
    if(hosting)html+=`<div class="room-panels"><article class="panel"><h2>Players</h2><div class="roster">${s.roster.filter(p=>!p.removed).map(p=>`<div class="player"><div>${esc(p.name)}<small>${esc(p.discord)}</small></div>${p.approved?'<span class="approved">Approved ✓</span>':`<button data-approve="${esc(p.id)}">Approve</button>`}<button data-remove="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">Remove</button></div>`).join('')||'<p class="empty-state">Your first guest is one invitation away.</p>'}</div></article><article class="panel"><h2>Personal invitations</h2><p class="quiet-note">Send each person a different link. It fills their code automatically.</p><div class="codegrid">${s.entries.filter(e=>!e.used).map(e=>`<div class="invite-row"><code>${esc(e.code)}</code><button data-copy="${esc(e.code)}">Copy invitation</button></div>`).join('')||'<p class="empty-state">Press Make 10 invitations below to begin.</p>'}</div></article></div>`;
  }
  if(s.phase==='section')html+=`<div class="center section-card"><span class="section-number">ROUND ${String(s.sectionNumber).padStart(2,'0')}</span><h1>${esc(s.section)}</h1><p>A new chapter. Same race to the top.</p><span class="pill">${hosting?'START THIS SECTION WHEN EVERYONE IS READY':'WAITING FOR AUDI TO START'}</span></div>`;
  if(s.phase==='final')html+=`<div class="center finale"><div class="eyebrow">ONE LAST QUESTION. EVERYTHING TO PLAY FOR.</div><h1>The finale.<br><em>Double the points.</em></h1><div class="huge">2×</div><p>Up to <b>2,000 points</b>.<br>Make your final answer count.</p><span class="pill">${hosting?'YOU CONTROL WHEN THE FINALE STARTS':'WAITING FOR AUDI TO START'}</span></div>`;
  if(s.phase==='question'){
    if(!s.question)html+=`<div class="center"><div class="eyebrow">${esc(s.section||'GET READY')}</div><h1>${!hosting&&!s.me?.approved?'Spectator mode':'Here we go.'}</h1><div class="huge" id="countdown">3</div></div>`;
    else html+=`<div class="topline"><span>${esc(s.section||'THE QUIZ')} · QUESTION ${s.index+1} / ${s.total}${s.question.final?' · 2× POINTS':''}</span><strong id="remaining"></strong></div><div class="timer"><div id="progress"></div></div><h2 class="question">${esc(s.question.text)}</h2>${s.me?.answered?'<div class="center"><span class="locked-icon">✓</span><h2>Answer locked.</h2><p>Your answer is saved. The reveal is coming.</p></div>':`<div class="answers">${s.question.answers.map((a,i)=>`<button class="answer" data-option="${i}" ${hosting?'disabled':''}><span>${['A','B','C','D'][i]}</span>${esc(a)}</button>`).join('')}</div>`}${hosting?`<p class="host-tip">${s.answerCount} answers received</p>`:''}`;
  }
  if(s.phase==='reveal')html+=`<div class="center"><div class="eyebrow">QUESTION ${s.index+1} COMPLETE</div><h1>${hosting?'The answer is in.':s.result?.correct?'Right on the money.':'There’s still the next one.'}</h1><div class="reveal-answer">${esc(s.correct)}</div>${!hosting?`<p class="score-gain">+${(s.result?.points||0).toLocaleString()} points</p>`:''}</div>${board(s)}<div class="progress-dots" aria-label="${s.index+1} of ${s.total} questions complete">${Array.from({length:s.total},(_,i)=>`<i class="${i<=s.index?'done':''}"></i>`).join('')}</div>`;
  if(s.phase==='finished')html+=`<div class="center"><div class="eyebrow">THE NIGHT’S WINNER’S CIRCLE</div><h1>The final five.</h1><p>${s.me?.rank?`You finished #${s.me.rank} with ${s.me.score.toLocaleString()} points.<br>`:''}Thanks for showing up. Audi will confirm the results and prize delivery.</p></div>${board(s)}`;
  $('gameBody').innerHTML=html+controls(s);
  document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=safe(()=>copy(invitation(b.dataset.copy))));
  document.querySelectorAll('[data-desk]').forEach(b=>b.onclick=()=>$('exitGame').click());
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=safe(async()=>{if(busy)return;busy=true;b.disabled=true;try{if(b.dataset.action==='export'){exportCSV();return;}await request(b.dataset.action,b.dataset.action==='entries'?{count:10}:b.dataset.action==='next'?{expected:{phase:s.phase,index:s.index}}:{});await refresh();}finally{busy=false;b.disabled=false;}}));
  document.querySelectorAll('[data-approve],[data-remove]').forEach(b=>b.onclick=safe(async()=>{b.disabled=true;try{await request(b.dataset.approve?'approve':'remove',{player:b.dataset.approve||b.dataset.remove});await refresh();}finally{b.disabled=false;}}));
  document.querySelectorAll('[data-option]').forEach(b=>b.onclick=safe(async()=>{if(answering)return;answering=true;document.querySelectorAll('[data-option]').forEach(x=>x.disabled=true);try{await request('answer',{round:s.question.round,option:Number(b.dataset.option)});await refresh();}catch(e){await refresh();throw e;}finally{answering=false;updateTimer();}}));updateTimer();
}
function updateTimer(){if(!state||state.phase!=='question')return;const now=Date.now()+offset;if($('countdown'))$('countdown').textContent=!hosting&&!state.me?.approved?'◇':Math.max(1,Math.ceil((state.started-now)/1000));if($('remaining'))$('remaining').textContent=Math.max(0,Math.ceil((state.deadline-now)/1000))+'s';if($('progress'))$('progress').style.width=Math.max(0,Math.min(100,(state.deadline-now)/(state.deadline-state.started)*100))+'%';document.querySelectorAll('[data-option]').forEach(b=>b.disabled=answering||hosting||now>=state.deadline);}
setInterval(updateTimer,100);
let exportURL=null;
function exportCSV(){const cell=v=>'"'+String(v).replaceAll('"','""')+'"',clean=v=>/^[=+@-]/.test(String(v))?"'"+v:v;const csv=['Rank,Name,Discord,Points,Correct,Correct answer response milliseconds,Requires tie review',...(state.leaderboard||[]).map(p=>[p.rank,clean(p.name),clean(p.discord||''),p.score,p.correct,p.elapsed,p.tied?'Yes':'No'].map(cell).join(','))].join('\r\n');if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));$('csvText').value=csv;$('csvDownload').href=exportURL;$('csvDownload').download=`audi-quiz-${room}.csv`;$('exportDialog').showModal();}
$('copyCSV').onclick=safe(()=>copy($('csvText').value));$('closeExport').onclick=()=>$('exportDialog').close();$('exportDialog').addEventListener('close',()=>{if(exportURL)URL.revokeObjectURL(exportURL);exportURL=null;});
async function boot(){if(hostPage){show('host');return;}let target=invitedRoom;if(!target){try{target=(await series('status')).active?.room||'';}catch{target=recalled('audiCurrent')?.room||'';}}const saved=target?recalled('audiPlayer:'+target):null;if(saved&&/^[A-Z0-9]{6}$/.test(saved.room)&&/^[a-f0-9]{32}$/.test(saved.player)){room=saved.room;player=saved.player;start();}else lobbyStatus();}boot();
