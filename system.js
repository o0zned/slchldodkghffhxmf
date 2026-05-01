const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ROMAN = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ'];
const SCALES = {
  major:      { intervals:[0,2,4,5,7,9,11], q:['maj','min','min','maj','maj','min','dim'] },
  dorian:     { intervals:[0,2,3,5,7,9,10], q:['min','min','maj','maj','min','dim','maj'] },
  phrygian:   { intervals:[0,1,3,5,7,8,10], q:['min','maj','maj','min','dim','maj','min'] },
  lydian:     { intervals:[0,2,4,6,7,9,11], q:['maj','maj','min','dim','maj','min','min'] },
  mixolydian: { intervals:[0,2,4,5,7,9,10], q:['maj','min','dim','maj','min','min','maj'] },
  minor:      { intervals:[0,2,3,5,7,8,10], q:['min','dim','maj','min','min','maj','maj'] },
  locrian:    { intervals:[0,1,3,5,6,8,10], q:['dim','maj','min','min','maj','maj','min'] },
};



function midiToFreq(m) { return 440*Math.pow(2,(m-69)/12); }

function chordNotes(rootSemi, q, type, oct) {
  const b = rootSemi + oct*12;
  if (type==='power') return [b, b+7];
  let iv = q==='maj' ? (type==='seventh'?[0,4,7,11]:[0,4,7])
         : q==='min' ? (type==='seventh'?[0,3,7,10]:[0,3,7])
         :              (type==='seventh'?[0,3,6,10]:[0,3,6]);
  return iv.map(i=>b+i);
}

function chordLabel(ri, q, type) {
  return NOTES[ri]+(q==='maj'?'':q==='min'?'m':'dim')+(type==='seventh'?'7':type==='power'?'5':'');
}

const S = { key:0, scaleName:'major', octave:3, chordType:'triad', synthType:'poly',
            delayMs:400, volume:0.5, currentDegree:-1, pendingDegree:-1, pendingTimer:null };

let synth=null, volNode=null;

function initAudio() { rebuildSynth(S.synthType); }

function rebuildSynth(type) {
  if (synth) { try{synth.releaseAll();}catch(e){} synth.dispose(); synth=null; }
  if (volNode) { volNode.dispose(); volNode=null; }
  volNode = new Tone.Volume(-8).toDestination();
  const opts = { envelope:{attack:0.04,decay:0.2,sustain:0.7,release:1.2} };
  synth = type==='fm'
    ? new Tone.PolySynth(Tone.FMSynth,{...opts,harmonicity:3,modulationIndex:8}).connect(volNode)
    : type==='am'
    ? new Tone.PolySynth(Tone.AMSynth,{...opts,harmonicity:2}).connect(volNode)
    : new Tone.PolySynth(Tone.Synth,{...opts,oscillator:{type:'triangle'}}).connect(volNode);
}

function setVol(v) { if(volNode) volNode.volume.rampTo(Tone.gainToDb(Math.max(0.001,v)),0.08); }

function playChord(deg) {
  if (!synth) return;
  const sc = SCALES[S.scaleName];
  const ri = (S.key + sc.intervals[deg]) % 12;
  const freqs = chordNotes(ri, sc.q[deg], S.chordType, S.octave).map(midiToFreq);
  synth.releaseAll();
  setTimeout(() => synth.triggerAttack(freqs), 20);
}

function stopAll() { if(synth) synth.releaseAll(); }

function buildPiano() {
  const bar = document.getElementById('piano-bar');
  bar.innerHTML = '';
  NOTES.forEach((n,i) => {
    const k = document.createElement('div');
    k.className = 'p-key'+(n.includes('#')?' sharp':'');
    k.dataset.i = i;
    const dot = document.createElement('div'); dot.className='p-dot';
    const nm  = document.createElement('div'); nm.className='p-name'; nm.textContent=n;
    k.appendChild(dot); k.appendChild(nm);
    k.addEventListener('click', ()=>selectKey(i));
    bar.appendChild(k);
  });
  refreshPiano();
}

function refreshPiano() {
  document.querySelectorAll('.p-key').forEach(k=>{
    k.classList.toggle('selected', parseInt(k.dataset.i)===S.key);
  });
  document.getElementById('hud-key').textContent = NOTES[S.key];
}

function selectKey(i) {
  S.key=i; refreshPiano();
  if (S.currentDegree>=0) { playChord(S.currentDegree); refreshChordUI(S.currentDegree); }
}

function scheduleDegree(deg) {
  if (deg===S.pendingDegree) return;
  S.pendingDegree=deg;
  if (S.pendingTimer) clearTimeout(S.pendingTimer);
  S.pendingTimer = setTimeout(()=>{
    if (deg===S.currentDegree) return;
    S.currentDegree=deg;
    if (deg>=0) { playChord(deg); refreshChordUI(deg); }
    else { stopAll(); clearChordUI(); }
  }, S.delayMs);
}

function refreshChordUI(deg) {
  const sc = SCALES[S.scaleName];
  const ri = (S.key + sc.intervals[deg]) % 12;
  const label = chordLabel(ri, sc.q[deg], S.chordType);
  document.getElementById('hud-chord').textContent = `${ROMAN[deg]} · ${label}`;
  document.getElementById('chord-main').textContent = label;
  document.getElementById('chord-roman').textContent = ROMAN[deg];
  ['chord-main','chord-roman'].forEach(id=>{
    const el = document.getElementById(id);
    el.classList.add('lit');
    setTimeout(()=>el.classList.remove('lit'), 700);
  });
}

function clearChordUI() {
  document.getElementById('hud-chord').textContent='—';
  document.getElementById('chord-main').textContent='—';
  document.getElementById('chord-roman').textContent='—';
}

const TIPS=[4,8,12,16,20], BASE=[3,6,10,14,18];
const vid=document.getElementById('webcam'), cvs=document.getElementById('canvas');
const ctx=cvs.getContext('2d');

function resizeCvs() { cvs.width=cvs.offsetWidth; cvs.height=cvs.offsetHeight; }
window.addEventListener('resize', resizeCvs);

function countFingers(lm) {
  let n=0;
  if (lm[4].x < lm[3].x) n++;
  for (let i=1;i<5;i++) if (lm[TIPS[i]].y < lm[BASE[i]].y) n++;
  return n;
}

function drawHand(lm) {
  const w=cvs.width,h=cvs.height;
  const C=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
            [9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(180,180,180,0.2)';
  ctx.lineWidth=1.5;
  C.forEach(([a,b])=>{
    ctx.beginPath();
    ctx.moveTo(lm[a].x*w,lm[a].y*h);
    ctx.lineTo(lm[b].x*w,lm[b].y*h);
    ctx.stroke();
  });
  lm.forEach((p,i)=>{
    const t=TIPS.includes(i);
    ctx.beginPath();
    ctx.arc(p.x*w,p.y*h,t?5:3,0,Math.PI*2);
    ctx.fillStyle=t?'rgba(220,220,220,0.75)':'rgba(130,130,130,0.5)';
    ctx.fill();
  });
}

function initMP() {
  const hands = new Hands({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
  hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:0.7,minTrackingConfidence:0.5});
  hands.onResults(res=>{
    ctx.clearRect(0,0,cvs.width,cvs.height);
    if (res.multiHandLandmarks?.length) {
      const lm=res.multiHandLandmarks[0];
      drawHand(lm);
      const f=countFingers(lm);
      const z=lm[0].z;
      const v=Math.max(0,Math.min(1,1-((z+0.25)/0.3)));
      S.volume=v; setVol(v);
      document.getElementById('vol-fill').style.height=(v*100)+'%';
      document.getElementById('hud-fingers').textContent=f;
      const fn=document.getElementById('finger-num');
      fn.textContent=f; fn.classList.toggle('lit',f>0);
      scheduleDegree(f>=1&&f<=7?f-1:-1);
    } else {
      document.getElementById('hud-fingers').textContent='—';
      const fn=document.getElementById('finger-num');
      fn.textContent='—'; fn.classList.remove('lit');
      scheduleDegree(-1);
    }
  });
  const cam=new Camera(vid,{onFrame:async()=>{await hands.send({image:vid});},width:640,height:480});
  cam.start().catch(()=>{document.getElementById('no-cam').style.display='block';});
}

document.getElementById('settings-btn').addEventListener('click',()=>{
  document.getElementById('settings-panel').classList.toggle('open');
});
document.addEventListener('click',e=>{
  const p=document.getElementById('settings-panel'),b=document.getElementById('settings-btn');
  if(!p.contains(e.target)&&!b.contains(e.target)) p.classList.remove('open');
});
document.getElementById('scale-select').addEventListener('change',e=>{
  S.scaleName=e.target.value;
  if(S.currentDegree>=0){playChord(S.currentDegree);refreshChordUI(S.currentDegree);}
});
document.getElementById('chord-type').addEventListener('change',e=>{
  S.chordType=e.target.value;
  if(S.currentDegree>=0){playChord(S.currentDegree);refreshChordUI(S.currentDegree);}
});
document.getElementById('synth-type').addEventListener('change',e=>{
  S.synthType=e.target.value; rebuildSynth(e.target.value); setVol(S.volume);
});
document.getElementById('octave-select').addEventListener('change',e=>{
  S.octave=parseInt(e.target.value);
  if(S.currentDegree>=0) playChord(S.currentDegree);
});
document.getElementById('delay-range').addEventListener('input',e=>{
  S.delayMs=parseFloat(e.target.value)*1000;
  document.getElementById('delay-val').textContent=e.target.value+'s';
});

document.getElementById('start-btn').addEventListener('click',async()=>{
  await Tone.start();
  initAudio();
  document.getElementById('start-overlay').style.display='none';
  resizeCvs();
  buildPiano();
  initMP();
});