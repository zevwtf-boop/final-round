// An original, low-volume city-night loop. Audio begins only after a user gesture.
(()=>{
  const button=document.getElementById('musicToggle'),volume=document.getElementById('musicVolume');
  let context,master,filter,enabled=false,clock=null,next=0,step=0,phase='lobby',voices=[];
  const bpm=82,beat=60/bpm,subdivision=beat/2;
  const chords=[[48,55,59,62,64],[45,52,55,59,62],[41,48,52,55,59],[43,50,53,57,62]];
  const hz=n=>440*Math.pow(2,(n-69)/12);
  function targetVolume(){return Number(volume.value)/100*.34*(phase==='question'?.28:1);}
  function updateVolume(){if(master)master.gain.setTargetAtTime(enabled?targetVolume():0,context.currentTime,.15);}
  function tone(note,time,length,level,type='sine'){
    const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;oscillator.frequency.value=hz(note);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+.04);gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    oscillator.connect(gain).connect(filter);oscillator.start(time);oscillator.stop(time+length+.05);voices.push(oscillator);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();voices=voices.filter(v=>v!==oscillator);};
  }
  function drum(time,hat=false){
    if(hat){const buffer=context.createBuffer(1,context.sampleRate*.045,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(data.length*.2));const source=context.createBufferSource(),hp=context.createBiquadFilter(),gain=context.createGain();hp.type='highpass';hp.frequency.value=5000;gain.gain.value=.055;source.buffer=buffer;source.connect(hp).connect(gain).connect(master);source.start(time);source.onended=()=>{source.disconnect();hp.disconnect();gain.disconnect();};}
    else{const oscillator=context.createOscillator(),gain=context.createGain();oscillator.frequency.setValueAtTime(105,time);oscillator.frequency.exponentialRampToValueAtTime(42,time+.16);gain.gain.setValueAtTime(.15,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.25);oscillator.connect(gain).connect(filter);oscillator.start(time);oscillator.stop(time+.28);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
  }
  function schedule(){
    if(!enabled||context.state!=='running')return;
    if(next<context.currentTime-.5)next=context.currentTime+.08;
    while(next<context.currentTime+.3){const bar=Math.floor(step/16),local=step%16,chord=chords[bar%chords.length];
      if(local===0)chord.forEach((n,i)=>tone(n+12,next+i*.035,beat*7.5,.045,'triangle'));
      if([0,6,8,14].includes(local))tone(chord[0]-12,next,beat*.9,.16);
      if([3,7,11,15].includes(local))tone(chord[[2,3,4,3][Math.floor(local/4)]]+24,next,beat*1.5,.035,'sine');
      if([0,8,11].includes(local))drum(next);
      if(local%2===1)drum(next,true);
      next+=subdivision;step++;
    }
  }
  async function toggle(){
    try{
      if(!context){context=new (window.AudioContext||window.webkitAudioContext)();master=context.createGain();master.gain.value=0;filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2600;filter.Q.value=.4;const compressor=context.createDynamicsCompressor();compressor.threshold.value=-22;filter.connect(master).connect(compressor).connect(context.destination);}
      enabled=!enabled;
      if(enabled){await context.resume();next=context.currentTime+.08;updateVolume();schedule();clearInterval(clock);clock=setInterval(schedule,100);}
      else{clearInterval(clock);updateVolume();setTimeout(()=>{if(!enabled)context.suspend();},650);}
      button.setAttribute('aria-pressed',String(enabled));document.getElementById('musicState').textContent=enabled?'After-hours instrumental':'Paused';document.getElementById('musicSymbol').textContent=enabled?'Ⅱ':'▶';
    }catch{enabled=false;document.getElementById('musicState').textContent='Audio unavailable';}
  }
  button.addEventListener('click',toggle);volume.addEventListener('input',updateVolume);
  document.addEventListener('quizphase',event=>{const changed=event.detail!==phase;phase=event.detail;updateVolume();if(enabled&&changed&&phase==='final'){[72,76,79,84].forEach((n,i)=>tone(n,context.currentTime+.12+i*.15,1.8,.09,'triangle'));}});
  document.addEventListener('visibilitychange',()=>{if(!context||!enabled)return;if(document.hidden){clearInterval(clock);context.suspend();}else{context.resume().then(()=>{next=context.currentTime+.08;schedule();clock=setInterval(schedule,100);});}});
})();
