/* ===================================================================
   soundEngine.js — 100% procedural audio via Web Audio API.
   Zero external files. Synthesizes six distinct chess sounds from
   scratch: wooden knock / heavy thud / check alert / castle double-
   click / promotion fanfare / game-start chord / win-lose melodies.
=================================================================== */
class SoundEngine{
  constructor(){
    this._ctx=null;
    this.enabled=true;
    this.vol=0.65;
  }

  _ac(){
    if(!this._ctx){
      try{ this._ctx=new(window.AudioContext||window.webkitAudioContext)(); }
      catch(e){ console.warn('Web Audio not supported'); return null; }
    }
    if(this._ctx.state==='suspended') this._ctx.resume();
    return this._ctx;
  }

  _master(){
    const ctx=this._ac(); if(!ctx) return null;
    const g=ctx.createGain(); g.gain.value=this.vol; g.connect(ctx.destination); return {ctx,out:g};
  }

  // Brown-noise buffer — reused for all percussive sounds
  _noiseBuf(sec){
    const ctx=this._ac(); if(!ctx) return null;
    const len=Math.ceil(ctx.sampleRate*sec);
    const buf=ctx.createBuffer(1,len,ctx.sampleRate);
    const d=buf.getChannelData(0);
    let last=0;
    for(let i=0;i<len;i++){ last=(Math.random()*2-1+last*0.96)/1.96; d[i]=last*2.2; }
    return buf;
  }

  // Core wooden-knock synthesizer
  // freq: bandpass centre, vol: 0-1, dur: seconds
  _knock(t, freq=1100, vol=1.0, dur=0.11){
    const r=this._master(); if(!r) return;
    const{ctx,out}=r;

    // --- noise burst (woody texture) ---
    const nb=this._noiseBuf(dur+0.06);
    if(nb){
      const ns=ctx.createBufferSource(); ns.buffer=nb;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=1.4;
      const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=400;
      const ng=ctx.createGain();
      ng.gain.setValueAtTime(vol*0.55,t);
      ng.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      ns.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(out);
      ns.start(t); ns.stop(t+dur+0.06);
    }

    // --- low thump (body resonance) ---
    const osc=ctx.createOscillator(); osc.type='sine';
    osc.frequency.setValueAtTime(freq*0.17,t);
    osc.frequency.exponentialRampToValueAtTime(freq*0.07,t+dur*0.55);
    const og=ctx.createGain();
    og.gain.setValueAtTime(vol*0.7,t);
    og.gain.exponentialRampToValueAtTime(0.0001,t+dur*0.7);
    osc.connect(og); og.connect(out);
    osc.start(t); osc.stop(t+dur);
  }

  // Bell tone for melodic events
  _bell(t, freq, vol=0.35, dur=0.5){
    const r=this._master(); if(!r) return;
    const{ctx,out}=r;
    [1,2,3].forEach((harmonic,i)=>{
      const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=freq*harmonic;
      const g=ctx.createGain();
      g.gain.setValueAtTime(vol/(i+1),t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dur/(i*0.4+1));
      o.connect(g); g.connect(out); o.start(t); o.stop(t+dur+0.05);
    });
  }

  // ===================== PUBLIC API =====================

  playMove(){
    if(!this.enabled) return;
    const ctx=this._ac(); if(!ctx) return;
    this._knock(ctx.currentTime,1100,0.72,0.1);
  }

  playCapture(){
    if(!this.enabled) return;
    const ctx=this._ac(); if(!ctx) return;
    this._knock(ctx.currentTime,680,1.0,0.17);
    // second lighter impact
    this._knock(ctx.currentTime+0.04,1200,0.3,0.08);
  }

  playCheck(){
    if(!this.enabled) return;
    const r=this._master(); if(!r) return;
    const{ctx,out}=r; const t=ctx.currentTime;
    this._knock(t,1100,0.7,0.1);
    // alert ping
    const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=1320;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0,t+0.06);
    g.gain.linearRampToValueAtTime(0.4,t+0.1);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
    o.connect(g); g.connect(out); o.start(t+0.06); o.stop(t+0.6);
  }

  playCastle(){
    if(!this.enabled) return;
    const ctx=this._ac(); if(!ctx) return;
    const t=ctx.currentTime;
    this._knock(t,    1100, 0.65, 0.10);
    this._knock(t+0.14, 1000, 0.5,  0.10);
  }

  playPromotion(){
    if(!this.enabled) return;
    const ctx=this._ac(); if(!ctx) return;
    const t=ctx.currentTime;
    // ascending major arpeggio: C5 E5 G5 C6
    [523.25, 659.25, 783.99, 1046.5].forEach((f,i)=>{
      this._bell(t+i*0.13, f, 0.38, 0.45);
    });
  }

  playGameStart(){
    if(!this.enabled) return;
    const ctx=this._ac(); if(!ctx) return;
    const t=ctx.currentTime;
    // G4 A4 C5 — quick ascending three-note figure
    [392, 440, 523.25].forEach((f,i)=>{
      this._bell(t+i*0.14, f, 0.28, 0.35);
    });
  }

  playGameEnd(won){
    if(!this.enabled) return;
    const ctx=this._ac(); if(!ctx) return;
    const t=ctx.currentTime;
    const notes = won
      ? [392, 493.88, 587.33, 783.99, 1046.5]  // ascending: G A B G C — victory
      : [523.25, 466.16, 415.30, 349.23];         // descending minor — defeat
    notes.forEach((f,i)=>{ this._bell(t+i*0.2, f, 0.32, 0.45); });
  }

  playLowTime(){
    if(!this.enabled) return;
    const r=this._master(); if(!r) return;
    const{ctx,out}=r; const t=ctx.currentTime;
    const o=ctx.createOscillator(); o.type='square'; o.frequency.value=220;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.08,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.07);
    o.connect(g); g.connect(out); o.start(t); o.stop(t+0.1);
  }

  toggle(){ this.enabled=!this.enabled; return this.enabled; }
}
