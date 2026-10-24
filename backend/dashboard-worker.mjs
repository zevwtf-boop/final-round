const fail = (message, status=400) => { throw Object.assign(new Error(message), {status}); };
const token = () => crypto.randomUUID().replaceAll('-', '');
function score(elapsed, duration, final=false) {
  return Math.round((1-Math.min(1, Math.max(0,elapsed/duration))/2)*(final?2000:1000));
}
function validateQuestions(items) {
  if (!Array.isArray(items)||items.length<2||items.length>50) fail('Use 2–50 questions.');
  return items.map(q=>{
    if(typeof q.text!=='string'||!q.text.trim()||q.text.length>300||!Array.isArray(q.answers)||q.answers.length!==4||q.answers.some(a=>typeof a!=='string'||!a.trim()||a.length>150)||!Number.isInteger(q.correct)||q.correct<0||q.correct>3||!Number.isInteger(q.seconds)||q.seconds<5||q.seconds>60) fail('Each question needs text, four answers, correct index 0–3 and a 5–60 second timer.');
    if(q.section!==undefined&&(typeof q.section!=='string'||!q.section.trim()||q.section.length>60))fail('Use a section name under 60 characters.');
    return {text:q.text.trim(),answers:q.answers.map(a=>a.trim()),correct:q.correct,seconds:q.seconds,...(q.section?{section:q.section.trim()}: {})};
  });
}
class Engine {
  constructor(state) { this.s=state; }
  static create(questions,title='Giveaway night') {
    return {title:String(title).slice(0,80),questions:validateQuestions(questions),phase:'lobby',index:-1,players:[],entries:[],started:0,deadline:0,round:null};
  }
  tick(now) { if(this.s.phase==='question'&&now>=this.s.deadline) this.s.phase='reveal'; }
  join(name,entry,discord) {
    const s=this.s;
    if(s.phase!=='lobby') fail('The lobby is closed.',409);
    if(typeof name==='string')name=name.normalize('NFKC').trim();
    if(typeof name!=='string'||!/^[\p{L}\p{N} _.-]{2,24}$/u.test(name)) fail('Use a 2–24 character display name.');
    if(s.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) fail('That display name is taken.',409);
    const code=s.entries.find(c=>c.code===entry&&!c.used);
    if(!code) fail('Entry code is invalid or already used.',403);
    if(typeof discord!=='string'||!/^[a-zA-Z0-9_.]{2,32}(#[0-9]{4})?$/.test(discord.trim()))fail('Enter your Discord username, not your display name.');
    discord=discord.trim().toLowerCase();
    if(s.players.some(p=>p.discord===discord))fail('That Discord username is already registered.',409);
    if(s.players.length>=200) fail('Room is full.',409);
    code.used=true;
    const p={id:token(),name,discord,approved:false,removed:false,score:0,correct:0,elapsed:0,answers:{},order:[]};
    s.players.push(p);return p;
  }
  player(id) { const p=this.s.players.find(p=>p.id===id&&!p.removed);if(!p)fail('Player session unavailable.',401);return p; }
  next(now) {
    const s=this.s;this.tick(now);
    if(!['lobby','reveal','section','final'].includes(s.phase))fail('Close the current round first.',409);
    if(!s.players.some(p=>p.approved&&!p.removed))fail('Approve at least one player.');
    if(s.phase==='final'||s.phase==='section') {
      s.phase='question';s.started=now+3000;s.deadline=s.started+s.questions[s.index].seconds*1000;s.round=token();
      for(const p of s.players) p.order=[0,1,2,3].map(i=>({i,r:crypto.getRandomValues(new Uint32Array(1))[0]})).sort((a,b)=>a.r-b.r).map(x=>x.i);
      return;
    }
    if(s.index+1===s.questions.length){s.phase='finished';return;}
    s.index++;
    if(s.index===s.questions.length-1){s.phase='final';return;}
    if(s.questions[s.index].section&&(s.index===0||s.questions[s.index].section!==s.questions[s.index-1].section)){s.phase='section';return;}
    s.phase='final';this.next(now);
  }
  answer(id,round,option,now) {
    this.tick(now);const s=this.s,p=this.player(id);
    if(!p.approved)fail('Wait for host approval.',403);
    if(s.phase!=='question'||now<s.started||now>=s.deadline||round!==s.round)fail('This round is not accepting answers.',409);
    if(Object.hasOwn(p.answers,s.index))fail('Your answer is already locked.',409);
    if(!Number.isInteger(option)||option<0||option>3)fail('Choose one answer.');
    const elapsed=now-s.started,correct=p.order[option]===s.questions[s.index].correct;
    const points=correct?score(elapsed,s.questions[s.index].seconds*1000,s.index===s.questions.length-1):0;
    p.answers[s.index]={option,correct,points,elapsed};p.score+=points;p.correct+=Number(correct);p.elapsed+=correct?elapsed:0;
  }
  view(id,host,now) {
    this.tick(now);const s=this.s,p=id?this.player(id):null;
    const v={title:s.title,phase:s.phase,index:s.index,total:s.questions.length,now,started:s.started,deadline:s.deadline,players:s.players.filter(p=>!p.removed).length};
    v.practice=!!s.practice;
    if(s.index>=0){v.section=s.questions[s.index].section||'';v.sectionNumber=new Set(s.questions.slice(0,s.index+1).map(q=>q.section).filter(Boolean)).size;}
    if(p)v.me={name:p.name,approved:p.approved,score:p.score-(s.phase==='question'?(p.answers[s.index]?.points||0):0),answered:Object.hasOwn(p.answers,s.index)};
    if(s.phase==='question'&&now>=s.started&&(host||p?.approved)) {
      const q=s.questions[s.index];v.question={text:q.text,answers:host?q.answers:p.order.map(i=>q.answers[i]),round:s.round,final:s.index===s.questions.length-1};
    }
    if(['reveal','finished'].includes(s.phase)) {
      v.leaderboard=s.players.filter(p=>p.approved&&!p.removed).sort((a,b)=>b.score-a.score||b.correct-a.correct||a.elapsed-b.elapsed||a.name.localeCompare(b.name)).map(p=>({name:p.name,...(host?{discord:p.discord}:{}),score:p.score,correct:p.correct,elapsed:p.elapsed}));
      const same=(a,b)=>a&&b&&a.score===b.score&&a.correct===b.correct&&a.elapsed===b.elapsed;
      v.leaderboard.forEach((p,i,all)=>{p.rank=i&&same(p,all[i-1])?all[i-1].rank:i+1;p.tied=Boolean(same(p,all[i-1])||same(p,all[i+1]));});
      if(p)v.me.rank=v.leaderboard.find(entry=>entry.name===p.name)?.rank;
      if(!host)v.leaderboard=v.leaderboard.slice(0,5);
      if(s.index>=0){v.correct=s.questions[s.index].answers[s.questions[s.index].correct];if(p)v.result=p.answers[s.index]||null;}
    }
    if(host){v.roster=s.players.map(p=>({id:p.id,name:p.name,discord:p.discord,approved:p.approved,removed:p.removed,score:p.score}));v.entries=s.entries;v.answerCount=s.players.filter(p=>p.approved&&!p.removed&&Object.hasOwn(p.answers,s.index)).length;}
    return v;
  }
}

const hostActions=['create','entries','approve','remove','next','close','export','load','save','launch','practice'];
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function readBody(request){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail('JSON content required.',415);
  const reader=request.body?.getReader();if(!reader)return {};
  const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>50000){await reader.cancel();fail('Request too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes)||'{}');
}
export default {async fetch(request,env) {
  const origin=request.headers.get('Origin');
  if(!env.ALLOWED_ORIGIN||origin!==env.ALLOWED_ORIGIN)return json({error:'Origin not allowed.'},403);
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
  if(request.method==='OPTIONS')return new Response(null,{headers});
  try {
    if(request.method!=='POST')fail('POST required.',405);
    const path=new URL(request.url).pathname;
    const series=/^\/quiz\/audi\/(status|load|save|launch|practice)$/.test(path);
    if(!series&&!/^\/room\/[A-Z0-9]{6}\/[a-z]+$/.test(path))fail('Invalid route.',404);
    if(Number(request.headers.get('Content-Length')||0)>50000)fail('Request too large.',413);
    const room=path.split('/')[2],action=path.split('/')[3];
    const b=await readBody(request);
    if(!b||typeof b!=='object'||Array.isArray(b))fail('JSON object required.');
    if(action==='join')b.clientKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode((env.HOST_KEY||'')+'|'+(request.headers.get('CF-Connecting-IP')||'unknown'))))).map(n=>n.toString(16).padStart(2,'0')).join('');
    const isHost=!!env.HOST_KEY&&request.headers.get('Authorization')===`Bearer ${env.HOST_KEY}`;
    if(hostActions.includes(action)&&!isHost)fail('Host authentication required.',401);
    if(!series&&['summary'].includes(action))fail('Invalid route.',404);
    const id=env.ROOMS.idFromName(series?'quiz-audi':room);
    const result=await env.ROOMS.get(id).fetch(new Request('https://room/'+(series?'series':'')+action,{method:'POST',body:JSON.stringify({b,isHost})}));
    return new Response(result.body,{status:result.status,headers:{...headers,'Content-Type':'application/json'}});
  }catch(e){return new Response(JSON.stringify({error:e.status?e.message:'Request could not be processed.'}),{status:e.status||400,headers:{...headers,'Content-Type':'application/json'}});}
}};
export class QuizRoom {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async series(action,b,isHost){
    const storage=this.ctx.storage;
    if(action!=='seriesstatus'&&!isHost)fail('Host authentication required.',401);
    let template=await storage.get('template'),active=await storage.get('active-room');
    const summary=async pin=>{
      const response=await this.env.ROOMS.get(this.env.ROOMS.idFromName(pin)).fetch(new Request('https://room/summary',{method:'POST',body:JSON.stringify({b:{},isHost:true})}));
      if(!response.ok)return null;
      return {room:pin,...await response.json()};
    };
    if(action==='seriessave'){
      template={title:String(b.title||"Audi’s After Hours").slice(0,80),questions:validateQuestions(b.questions),savedAt:Date.now()};
      await storage.put('template',template);return json({saved:true,total:template.questions.length});
    }
    if(action==='seriesload')return json({template:template||null,active:active?await summary(active):null});
    if(action==='seriesstatus')return json({ready:!!template,title:template?.title||"Audi’s After Hours",total:template?.questions.length||21,active:active?await summary(active):null});
    if(!['serieslaunch','seriespractice'].includes(action))fail('Invalid action.',404);
    if(typeof b.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(b.requestId))fail('A valid launch request is required.');
    const receipts=await storage.get('launch-receipts')||[];
    const receipt=receipts.find(r=>r.id===b.requestId&&r.action===action);if(receipt)return json({room:receipt.room});
    const practice=action==='seriespractice';
    if(!practice&&!template)fail('Save your quiz first.',409);
    if(!practice&&active){const old=await summary(active);if(old&&old.phase!=='finished'&&b.replace!==active)fail('An unfinished lobby exists. Resume it or confirm opening a fresh lobby.',409);}
    const questions=practice?[
      {text:'Practice: how many sides does a triangle have?',answers:['Two','Three','Four','Five'],correct:1,seconds:15,section:'Sound check'},
      {text:'Practice finale: what is 12 × 12?',answers:['124','144','132','148'],correct:1,seconds:15,section:'The finale'}
    ]:template.questions;
    let pin,created=false;
    for(let i=0;i<5;i++){
      pin=token().slice(0,6).toUpperCase();
      const response=await this.env.ROOMS.get(this.env.ROOMS.idFromName(pin)).fetch(new Request('https://room/create',{method:'POST',body:JSON.stringify({b:{questions,title:practice?'Audi · Practice room':template.title,practice},isHost:true})}));
      if(response.ok){created=true;break;}if(response.status!==409)fail('Could not create a lobby.',503);
    }
    if(!created)fail('Could not allocate a room. Try again.',503);
    if(!practice)await storage.put('active-room',pin);
    await storage.put('launch-receipts',[...receipts,{id:b.requestId,action,room:pin}].slice(-30));
    return json({room:pin});
  }
  async fetch(req) {
    return this.ctx.blockConcurrencyWhile(async()=>{
      try {
        const {b,isHost}=await req.json(),action=new URL(req.url).pathname.slice(1),now=Date.now();
        if(action.startsWith('series'))return await this.series(action,b,isHost);
        if(hostActions.includes(action)&&!isHost)fail('Host authentication required.',401);
        let s=await this.ctx.storage.get('state');
        if(action==='create'){if(s)fail('Room already exists.',409);s=Engine.create(b.questions,b.title);s.practice=!!b.practice;}
        if(!s)fail('Room not found.',404);
        const previousPhase=s.phase;const e=new Engine(s);e.tick(now);let result;
        if(action==='summary')return json({title:s.title,phase:s.phase,players:s.players.filter(p=>!p.removed).length,total:s.questions.length});
        if(action==='join') {
          const rates=(await this.ctx.storage.get('join-rates')||[]).filter(r=>r.until>now);
          let rate=rates.find(r=>r.key===b.clientKey);
          if(rate?.count>=20)fail('Too many unsuccessful entries. Wait one minute and try again.',429);
          try{const p=e.join(b.name,b.entry,b.discord);result={player:p.id};}
          catch(error){if(!rate){rate={key:b.clientKey,count:0,until:now+60000};rates.push(rate);}rate.count++;await this.ctx.storage.put('join-rates',rates.slice(-1024));throw error;}
        }
        else if(action==='entries'){if(s.phase!=='lobby')fail('Entries are locked.',409);if(s.entries.length>=200)fail('Entry limit reached.');const n=Math.min(200-s.entries.length,Math.max(1,Number(b.count)||1));for(let i=0;i<n;i++)s.entries.push({code:token().slice(0,12).toUpperCase(),used:false});}
        else if(action==='approve'||action==='remove'){if(s.phase!=='lobby'&&action==='approve')fail('Approval is locked.',409);const p=e.player(b.player);p[action==='approve'?'approved':'removed']=true;}
        else if(action==='next'){if(b.expected&&(b.expected.index!==s.index||b.expected.phase!==s.phase))fail('The room has already moved on. Refresh and continue.',409);e.next(now);}
        else if(action==='close'){if(s.phase!=='question')fail('No active round.',409);s.phase='reveal';}
        else if(action==='answer')e.answer(b.player,b.round,b.option,now);
        else if(!['state','create','join','export'].includes(action))fail('Unknown action.',404);
        if(action==='state'&&!isHost)e.player(b.player);
        if(action!=='state'||previousPhase!==s.phase)await this.ctx.storage.put('state',s);
        return json(result||e.view(isHost?null:b.player,isHost,now));
      }catch(e){return json({error:e.status?e.message:'Room request failed.'},e.status||400);}
    });
  }
}
