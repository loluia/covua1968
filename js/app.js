/* ===================================================================
   app.js — conductor. v2: adds sound, move quality classification,
   opening detection, material advantage score, low-time warning,
   and a sound toggle button.
=================================================================== */

// Move quality thresholds (centipawns, from mover's perspective)
const QUALITY_TIERS=[
  {min:200,  symbol:'!!', label:'Nước xuất sắc', cls:'brilliant'},
  {min:50,   symbol:'!',  label:'Nước hay',       cls:'great'},
  {min:-49,  symbol:'',   label:'Nước tốt',        cls:'good'},
  {min:-99,  symbol:'?!', label:'Thiếu chính xác', cls:'inaccuracy'},
  {min:-199, symbol:'?',  label:'Sai lầm',         cls:'mistake'},
  {min:-9999,symbol:'??', label:'Sai lầm nghiêm trọng', cls:'blunder'},
];

function classifyDelta(delta){
  for(const t of QUALITY_TIERS) if(delta>=t.min) return t;
  return QUALITY_TIERS[QUALITY_TIERS.length-1];
}

class App{
  init(){
    this.canvas=document.getElementById('boardCanvas');
    this.scene=new SceneManager(this.canvas);
    this.pieces=new PieceManager(this.scene.worldRoot);
    this.engine=new ChessEngine();

    this.evalEngine=new EvalEngine(14);
    this.evalEngine.on('evaluation',info=>this._onEval(info));
    this.evalEngine.on('error',msg=>showToast(msg));

    this.sound=new SoundEngine();
    this.bot=null;this.multiplayer=null;

    this.mode=null;this.myColor='w';this.botColor=null;
    this.colorChoice='w';this.selectedSquare=null;this.pendingPromo=null;
    this.gameActive=false;

    // eval + quality tracking
    this.lastEvalCp=0;         // always White's perspective
    this.pendingQual=null;     // {moveIdx, colorMoved, evalBefore} set just before a move
    this.moveQualities={};     // moveIdx -> quality tier object

    // clocks
    this.clocks={w:600,b:600};this.clockTimer=null;this.clockColor=null;
    this._lowTimePlayed={w:false,b:false};

    this.pieces.syncWithBoard(this.engine.boardSnapshot());
    this._bindUI();this._bindBoard();

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.getElementById('loadingOverlay').classList.add('hidden');
      this.sound.playGameStart();
    }));
  }

  /* ================================================================
     UI BINDINGS
  ================================================================ */
  _bindUI(){
    // mode tabs
    document.querySelectorAll('.mode-tab').forEach(tab=>tab.addEventListener('click',()=>{
      document.querySelectorAll('.mode-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');
      const m=tab.dataset.mode;
      document.getElementById('panelBot').classList.toggle('hidden',m!=='bot');
      document.getElementById('panelFriend').classList.toggle('hidden',m!=='friend');
    }));
    // friend tabs
    document.querySelectorAll('.friend-tab').forEach(tab=>tab.addEventListener('click',()=>{
      document.querySelectorAll('.friend-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');
      const f=tab.dataset.ftab;
      document.getElementById('friendCreate').classList.toggle('hidden',f!=='create');
      document.getElementById('friendJoin').classList.toggle('hidden',f!=='join');
    }));
    // color choice
    document.querySelectorAll('#colorChoice .seg-btn').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('#colorChoice .seg-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');this.colorChoice=btn.dataset.color;
    }));
    document.getElementById('btnStartBot').addEventListener('click',()=>
      this.startBotGame(parseInt(document.getElementById('botDifficulty').value,10),this.colorChoice));

    // friend: create
    document.getElementById('btnCreateRoom').addEventListener('click',()=>{
      this._teardown();
      const btn=document.getElementById('btnCreateRoom');
      btn.disabled=true;btn.textContent='Đang tạo…';
      document.getElementById('roomCodeBox').classList.add('hidden');
      document.getElementById('hostWaitText').textContent='';
      this.multiplayer=new MultiplayerSession();this._wireMp();
      this.multiplayer.on('roomCreated',code=>{
        btn.disabled=false;btn.textContent='Tạo mã phòng mới';
        document.getElementById('roomCodeText').textContent=code;
        document.getElementById('roomCodeBox').classList.remove('hidden');
        document.getElementById('hostWaitText').textContent='Đang chờ đối thủ…';
      });
      this.multiplayer.createRoom();
    });
    document.getElementById('btnCopyRoom').addEventListener('click',()=>
      this._copy(document.getElementById('roomCodeText').textContent));

    // friend: join
    document.getElementById('btnJoinRoom').addEventListener('click',()=>{
      const code=document.getElementById('joinCodeInput').value.trim();
      if(!code){showToast('Nhập mã phòng trước.');return;}
      this._teardown();
      const btn=document.getElementById('btnJoinRoom');
      btn.disabled=true;btn.textContent='Đang kết nối…';
      this.multiplayer=new MultiplayerSession();this._wireMp();
      this.multiplayer.on('joinFailed',msg=>{btn.disabled=false;btn.textContent='Kết nối';showToast(msg);});
      this.multiplayer.on('peerConnected',()=>{btn.disabled=false;btn.textContent='Kết nối';});
      this.multiplayer.joinRoom(code);
    });

    // topbar
    document.getElementById('btnFlip').addEventListener('click',()=>this.scene.flipBoard());
    document.getElementById('btnUndo').addEventListener('click',()=>this._undo());
    document.getElementById('btnResign').addEventListener('click',()=>this._resign());
    document.getElementById('btnNewGame').addEventListener('click',()=>this._newGame());
    document.getElementById('btnSound').addEventListener('click',()=>{
      const on=this.sound.toggle();
      document.getElementById('btnSound').textContent=on?'🔊':'🔇';
      document.getElementById('btnSound').title=on?'Tắt âm':'Bật âm';
    });

    // promotion
    document.querySelectorAll('#promoOptions .promo-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const piece=btn.dataset.piece,{from,to}=this.pendingPromo;
      this.pendingPromo=null;
      document.getElementById('promotionModal').classList.add('hidden');
      this.applyMove(from,to,piece,'local');
    }));

    // game over
    document.getElementById('btnPlayAgain').addEventListener('click',()=>{
      document.getElementById('gameOverModal').classList.add('hidden');this._newGame();});
    document.getElementById('btnCloseGameOver').addEventListener('click',()=>
      document.getElementById('gameOverModal').classList.add('hidden'));

    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  }

  _copy(text){
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(()=>showToast('Đã sao chép!'),()=>this._fallbackCopy(text));
    else this._fallbackCopy(text);
  }
  _fallbackCopy(text){
    const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');showToast('Đã sao chép!');}catch(e){showToast('Copy thủ công nhé.');}
    document.body.removeChild(ta);
  }

  /* ================================================================
     BOARD INPUT
  ================================================================ */
  _bindBoard(){
    let dx=0,dy=0,drag=false;
    this.canvas.addEventListener('pointerdown',e=>{dx=e.clientX;dy=e.clientY;drag=false;});
    this.canvas.addEventListener('pointermove',e=>{if(Math.abs(e.clientX-dx)>4||Math.abs(e.clientY-dy)>4)drag=true;});
    this.canvas.addEventListener('pointerup',e=>{if(drag)return;const sq=this._sqAt(e.clientX,e.clientY);if(sq)this._clicked(sq);});
  }
  _sqAt(cx,cy){
    const ndc=this.scene.getPointerNDC(cx,cy);
    const objs=[...this.scene.boardTiles,...this.pieces.bySquare.values()];
    const hit=this.scene.raycastFirst(ndc,objs,true);if(!hit)return null;
    if(hit.object.userData&&hit.object.userData.square)return hit.object.userData.square;
    let node=hit.object;
    while(node){for(const[sq,m]of this.pieces.bySquare)if(m===node)return sq;node=node.parent;}
    return null;
  }
  _clicked(sq){
    if(!this.gameActive||this.pendingPromo)return;
    if(this.mode==='bot'&&this.bot&&this.bot.thinking)return;
    if(this.engine.turn()!==this.myColor)return;
    const piece=this.engine.pieceAt(sq);
    if(this.selectedSquare){
      if(sq===this.selectedSquare){this._desel();return;}
      const mv=this.engine.legalMovesFrom(this.selectedSquare).find(m=>m.to===sq);
      if(mv){
        const from=this.selectedSquare;this._desel();
        if(this.engine.needsPromotion(from,sq)){this.pendingPromo={from,to:sq};document.getElementById('promotionModal').classList.remove('hidden');}
        else this.applyMove(from,sq,undefined,'local');
        return;
      }
      if(piece&&piece.color===this.myColor)this._sel(sq);else this._desel();
      return;
    }
    if(piece&&piece.color===this.myColor)this._sel(sq);
  }
  _sel(sq){this.selectedSquare=sq;this.scene.setSelectedSquare(sq);this.pieces.setSelected(sq);this.scene.setLegalMarkers(this.engine.legalMovesFrom(sq));}
  _desel(){this.selectedSquare=null;this.scene.clearSelectedSquare();this.scene.clearLegalMarkers();this.pieces.clearSelected();}

  /* ================================================================
     MOVE APPLICATION
  ================================================================ */
  applyMove(from,to,promotion,source){
    const mc=this.engine.turn();

    // snapshot eval BEFORE the move for quality classification
    const evalBefore=this.lastEvalCp;

    const r=this.engine.move(from,to,promotion);
    if(!r)return null;

    const moveIdx=this.engine.history().length-1;
    // store pending classification — resolved when next eval fires
    this.pendingQual={moveIdx, colorMoved:mc, evalBefore};

    // build extra for 3D animation
    const extra={};
    if(r.flags.includes('e'))extra.capturedSquare=to[0]+from[1];
    else if(r.captured)extra.capturedSquare=to;
    if(r.flags.includes('k')||r.flags.includes('q')){
      const rk=mc==='w'?'1':'8';
      if(r.flags.includes('k')){extra.rookFrom='h'+rk;extra.rookTo='f'+rk;}
      else{extra.rookFrom='a'+rk;extra.rookTo='d'+rk;}
    }

    // sound
    if(r.flags.includes('k')||r.flags.includes('q')) this.sound.playCastle();
    else if(r.flags.includes('p')&&promotion)        this.sound.playPromotion();
    else if(r.captured||r.flags.includes('e'))       this.sound.playCapture();
    else                                              this.sound.playMove();

    this.pieces.animateMove(from,to,extra,()=>{
      if(r.flags.includes('p')&&promotion)this.pieces.promoteAt(to,promotion,mc);
    });
    this.scene.setLastMove(from,to);
    this._updateMoveList();
    this._updateCaptured();
    this.clockColor=this.engine.turn();

    // check / checkmate banner
    if(this.engine.inCheck()&&!this.engine.isGameOver()){
      const ks=this.engine.boardSnapshot().find(p=>p.type==='k'&&p.color===this.engine.turn());
      document.getElementById('checkBanner').textContent=this.engine.turn()===this.myColor?'BẠN ĐANG BỊ CHIẾU':'ĐỐI THỦ ĐANG BỊ CHIẾU';
      document.getElementById('checkBanner').classList.add('show');
      this.scene.setCheckSquare(ks?ks.square:null);
      this.sound.playCheck();
    } else {
      document.getElementById('checkBanner').classList.remove('show');
      this.scene.clearCheckSquare();
    }

    // network relay
    if(source==='local'&&this.mode&&this.mode.startsWith('friend')&&this.multiplayer)
      this.multiplayer.send({type:'move',from,to,promotion:promotion||null});

    if(this.engine.isGameOver()) this._gameOver(this.engine.getGameOverInfo());
    else{
      this.evalEngine.evaluate(this.engine.fen());
      this._updateOpening();
      if(this.mode==='bot'&&this.engine.turn()===this.botColor) this._botMove();
    }
    return r;
  }

  /* ================================================================
     EVAL CALLBACK — also handles move quality classification
  ================================================================ */
  _onEval({cp,mate,whiteWinProb,depth}){
    // only accept evaluations at depth >= 6 for quality classification
    const highEnough=(depth===null||depth>=6);

    if(highEnough&&this.pendingQual){
      const{moveIdx,colorMoved,evalBefore}=this.pendingQual;
      this.pendingQual=null;

      // delta from the MOVER's perspective
      let delta;
      if(colorMoved==='w') delta=cp-evalBefore;  // positive = improved for White
      else                  delta=evalBefore-cp;   // positive = improved for Black

      const quality=classifyDelta(delta);
      this.moveQualities[moveIdx]=quality;
      this._updateMoveList(); // re-render badges
    }

    this.lastEvalCp=cp;
    this._updateEvalUI({cp,mate,whiteWinProb});
  }

  /* ================================================================
     BOT
  ================================================================ */
  _botMove(){
    this._status('Bot đang suy nghĩ…','warn');
    this.bot.requestMove(this.engine.fen()).then(uci=>{
      if(!uci||!this.gameActive)return;
      this.applyMove(uci.slice(0,2),uci.slice(2,4),uci.length>4?uci[4]:undefined,'bot');
      if(this.gameActive)this._status('Đang đấu với Bot','live');
    });
  }

  /* ================================================================
     GAME LIFECYCLE — vs Bot
  ================================================================ */
  startBotGame(skill,colorChoice){
    this._teardown();this.mode='bot';
    this.myColor=colorChoice==='random'?(Math.random()<.5?'w':'b'):colorChoice;
    this.botColor=this.myColor==='w'?'b':'w';
    this.bot=new StockfishBot();this.bot.setDifficulty(skill);this.bot.on('error',msg=>showToast(msg));
    this.engine.reset();this.pieces.syncWithBoard(this.engine.boardSnapshot());
    this._clearUI();this._orient();this._resetQuality();
    document.getElementById('nameTop').textContent='Bot Stockfish';
    document.getElementById('nameBottom').textContent='Bạn';
    document.getElementById('subTop').textContent=`Skill ${skill} · ${this.botColor==='w'?'Trắng':'Đen'}`;
    document.getElementById('subBottom').textContent=this.myColor==='w'?'Quân Trắng':'Quân Đen';
    document.getElementById('hostWaitText').textContent='';
    this._resetClocks(600);this.gameActive=true;this._startClocks();
    this._status(`Đang đấu với Bot (Skill ${skill})`,'live');
    document.getElementById('gameStatusBox').textContent='Trận đấu với Stockfish đang diễn ra.';
    this.evalEngine.evaluate(this.engine.fen());
    this._updateMoveList();this._updateCaptured();this._updateOpening();
    this.sound.playGameStart();
    if(this.engine.turn()===this.botColor)this._botMove();
  }

  /* ================================================================
     GAME LIFECYCLE — vs Friend
  ================================================================ */
  _wireMp(){
    const mp=this.multiplayer;
    mp.on('peerConnected',role=>this._startFriend(role));
    mp.on('message',d=>this._netMsg(d));
    mp.on('peerDisconnected',()=>{
      showToast('Đối thủ đã rời phòng.');
      if(this.gameActive){this.gameActive=false;this._stopClocks();this._status('Đối thủ đã rời phòng.','error');}
    });
    mp.on('error',msg=>showToast(msg));
  }
  _startFriend(role){
    this.mode=role==='host'?'friend-host':'friend-guest';this.myColor=role==='host'?'w':'b';this.botColor=null;
    this.engine.reset();this.pieces.syncWithBoard(this.engine.boardSnapshot());
    this._clearUI();this._orient();this._resetQuality();
    document.getElementById('nameTop').textContent='Đối thủ';
    document.getElementById('nameBottom').textContent='Bạn';
    document.getElementById('subTop').textContent=this.myColor==='w'?'Quân Đen':'Quân Trắng';
    document.getElementById('subBottom').textContent=this.myColor==='w'?'Quân Trắng':'Quân Đen';
    document.getElementById('hostWaitText').textContent='Đã kết nối! Trận bắt đầu.';
    this._resetClocks(600);this.gameActive=true;this._startClocks();
    this._status('Đã kết nối — trận đấu bắt đầu!','live');
    document.getElementById('gameStatusBox').textContent='Đang thi đấu trực tuyến (P2P).';
    this.evalEngine.evaluate(this.engine.fen());
    this._updateMoveList();this._updateCaptured();this._updateOpening();
    this.sound.playGameStart();
  }
  _netMsg(d){
    if(!d||!d.type)return;
    if(d.type==='move')this.applyMove(d.from,d.to,d.promotion||undefined,'network');
    else if(d.type==='resign'){this._gameOver({type:'resign',winner:this.myColor});showToast('Đối thủ đã đầu hàng.');}
    else if(d.type==='newgame'){
      this.engine.reset();this.pieces.syncWithBoard(this.engine.boardSnapshot());
      this._clearUI();this._resetClocks(600);this._resetQuality();
      this.gameActive=true;this._startClocks();
      this._updateMoveList();this._updateCaptured();this._updateOpening();
      this.evalEngine.evaluate(this.engine.fen());
      this._status('Trận mới!','live');showToast('Đối thủ bắt đầu trận mới.');
      this.sound.playGameStart();
    }
    else if(d.type==='newgameRequest'&&this.multiplayer&&this.multiplayer.role==='host')this._friendNew();
  }
  _friendNew(){
    this.engine.reset();this.pieces.syncWithBoard(this.engine.boardSnapshot());
    this._clearUI();this._resetClocks(600);this._resetQuality();
    this.gameActive=true;this._startClocks();
    this._updateMoveList();this._updateCaptured();this._updateOpening();
    this.evalEngine.evaluate(this.engine.fen());
    if(this.multiplayer)this.multiplayer.send({type:'newgame',fen:this.engine.fen()});
    this._status('Trận mới!','live');this.sound.playGameStart();
  }
  _newGame(){
    if(this.mode==='bot')this.startBotGame(parseInt(document.getElementById('botDifficulty').value,10),this.colorChoice);
    else if(this.mode==='friend-host')this._friendNew();
    else if(this.mode==='friend-guest'){if(this.multiplayer){this.multiplayer.send({type:'newgameRequest'});showToast('Đã gửi yêu cầu trận mới.');}}
    else showToast('Chọn chế độ chơi trước.');
  }
  _resign(){
    if(!this.gameActive||!this.mode){showToast('Chưa có trận nào.');return;}
    if(this.mode.startsWith('friend')&&this.multiplayer)this.multiplayer.send({type:'resign'});
    this._gameOver({type:'resign',winner:this.myColor==='w'?'b':'w'});
  }
  _undo(){
    if(this.mode!=='bot'){showToast('Đi lại chỉ dùng khi đấu Bot.');return;}
    if(this.bot&&this.bot.thinking){showToast('Đợi Bot xong đã.');return;}
    if(!this.engine.undo()){showToast('Không có nước để đi lại.');return;}
    if(this.engine.turn()!==this.myColor)this.engine.undo();
    this.pieces.syncWithBoard(this.engine.boardSnapshot());this._clearUI();
    this._updateMoveList();this._updateCaptured();this._updateOpening();
    this.evalEngine.evaluate(this.engine.fen());
    document.getElementById('checkBanner').classList.remove('show');this.scene.clearCheckSquare();
    this.sound.playMove();
  }
  _teardown(){
    if(this.bot){this.bot.destroy();this.bot=null;}
    if(this.multiplayer){this.multiplayer.destroy();this.multiplayer=null;}
    this.gameActive=false;this._stopClocks();
  }
  _orient(){const f=this.myColor==='b';if(f!==this.scene.flipped)this.scene.flipBoard();}
  _clearUI(){
    this.scene.clearLastMove();this.scene.clearLegalMarkers();this.scene.clearSelectedSquare();this.scene.clearCheckSquare();
    this.pieces.clearSelected();this.selectedSquare=null;this.pendingPromo=null;
    document.getElementById('checkBanner').classList.remove('show');
    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('promotionModal').classList.add('hidden');
  }
  _resetQuality(){
    this.moveQualities={};this.pendingQual=null;this.lastEvalCp=0;
    this._lowTimePlayed={w:false,b:false};
  }

  /* ================================================================
     GAME OVER
  ================================================================ */
  _gameOver(info){
    this.gameActive=false;this._stopClocks();
    this.scene.clearLegalMarkers();this.scene.clearSelectedSquare();this.pieces.clearSelected();
    const opp=this.mode==='bot'?'Bot':'Đối thủ';let title,sub;
    if(info.type==='checkmate'){title='Chiếu hết!';sub=info.winner===this.myColor?'Bạn thắng!':opp+' thắng!';}
    else if(info.type==='resign'){title='Đầu hàng';sub=info.winner===this.myColor?opp+' đầu hàng. Bạn thắng!':'Bạn đã đầu hàng.';}
    else if(info.type==='timeout'){title='Hết giờ';sub=info.winner===this.myColor?opp+' hết giờ. Bạn thắng!':'Bạn hết giờ.';}
    else{const m={stalemate:'Stalemate — hết nước đi.',repetition:'Hoà — lặp vị trí 3 lần.',insufficient:'Hoà — không đủ lực chiếu hết.','fifty-move':'Hoà — luật 50 nước.',draw:'Hoà cờ.'};title='Hoà cờ';sub=m[info.type]||m.draw;}
    document.getElementById('gameOverTitle').textContent=title;
    document.getElementById('gameOverSub').textContent=sub;
    document.getElementById('gameOverModal').classList.remove('hidden');
    document.getElementById('gameStatusBox').textContent=title+' — '+sub;
    this._status(sub,info.winner==null?'warn':(info.winner===this.myColor?'live':'error'));
    this.sound.playGameEnd(info.winner===this.myColor);
  }

  /* ================================================================
     STATUS
  ================================================================ */
  _status(text,level){
    document.getElementById('statusText').textContent=text;
    document.getElementById('statusDot').className='status-dot'+(level?' '+level:'');
  }

  /* ================================================================
     MOVE LIST — with quality badges
  ================================================================ */
  _updateMoveList(){
    const h=this.engine.history();let html='';
    for(let i=0;i<h.length;i+=2){
      const n=i/2+1;
      const wsan=h[i]?h[i].san:'';
      const bsan=h[i+1]?h[i+1].san:'';
      const wq=this.moveQualities[i];
      const bq=this.moveQualities[i+1];
      const wbadge=wq&&wq.symbol?`<span class="q-badge q-${wq.cls}" title="${wq.label}">${wq.symbol}</span>`:'';
      const bbadge=bq&&bq.symbol?`<span class="q-badge q-${bq.cls}" title="${bq.label}">${bq.symbol}</span>`:'';
      html+=`<div class="move-row"><span class="move-num">${n}.</span><span class="move-san">${wsan}${wbadge}</span><span class="move-san">${bsan}${bbadge}</span></div>`;
    }
    const el=document.getElementById('moveList');el.innerHTML=html;el.scrollTop=el.scrollHeight;
  }

  /* ================================================================
     OPENING NAME
  ================================================================ */
  _updateOpening(){
    const h=this.engine.history().map(m=>m.san);
    const name=detectOpening(h);
    const el=document.getElementById('openingName');
    if(el){el.textContent=name||'';el.style.opacity=name?'1':'0';}
  }

  /* ================================================================
     CAPTURED + MATERIAL SCORE
  ================================================================ */
  _updateCaptured(){
    const oc=this.myColor==='w'?'b':'w';
    const wScore=this._capRow('capturedTop',this.engine.captured[oc],this.myColor);
    const bScore=this._capRow('capturedBottom',this.engine.captured[this.myColor],oc);
    // material advantage
    const diff=wScore-bScore; // positive = bottom player (myColor) ahead
    const advEl=document.getElementById('materialAdv');
    if(advEl){
      if(diff>0)advEl.textContent=`+${diff}`;
      else if(diff<0)advEl.textContent=`${diff}`;
      else advEl.textContent='';
    }
  }
  _capRow(id,types,gc){
    const el=document.getElementById(id);if(!el)return 0;
    const sorted=[...types].sort((a,b)=>pieceValue(b)-pieceValue(a));
    el.innerHTML=sorted.map(t=>`<span>${PIECE_GLYPH[gc][t]}</span>`).join('');
    return sorted.reduce((s,t)=>s+pieceValue(t),0);
  }

  /* ================================================================
     EVAL BAR
  ================================================================ */
  _updateEvalUI({cp,mate,whiteWinProb}){
    const pct=clamp(whiteWinProb*100,2,98);
    document.getElementById('evalFillWhite').style.height=pct+'%';
    let label;
    if(mate!=null){label=mate>0?`+M${mate}`:`−M${Math.abs(mate)}`;}
    else{const p=cp/100;label=(p>=0?'+':'')+p.toFixed(1);}
    document.getElementById('evalValue').textContent=label;
  }

  /* ================================================================
     CLOCKS
  ================================================================ */
  _fmt(sec){sec=Math.max(0,Math.round(sec));const m=Math.floor(sec/60),s=sec%60;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
  _renderClocks(){
    const oc=this.myColor==='w'?'b':'w';
    const botEl=document.getElementById('clockBottom');
    const topEl=document.getElementById('clockTop');
    botEl.textContent=this._fmt(this.clocks[this.myColor]);
    topEl.textContent=this._fmt(this.clocks[oc]);
    // low time visual warning
    botEl.classList.toggle('clock-low',this.clocks[this.myColor]<60&&this.clocks[this.myColor]>0);
    topEl.classList.toggle('clock-low',this.clocks[oc]<60&&this.clocks[oc]>0);
  }
  _resetClocks(s=600){this.clocks={w:s,b:s};this._renderClocks();}
  _startClocks(){
    this._stopClocks();this.clockColor=this.engine.turn();
    this.clockTimer=setInterval(()=>{
      if(!this.gameActive){this._stopClocks();return;}
      this.clocks[this.clockColor]-=0.25;
      // low time tick sound at exactly 10s, 20s, 30s remaining
      if([30,20,10,9,8,7,6,5,4,3,2,1].includes(Math.round(this.clocks[this.clockColor]))){
        const key='t'+Math.round(this.clocks[this.clockColor]);
        if(!this._lowTimePlayed[key]){this._lowTimePlayed[key]=true;this.sound.playLowTime();}
      }
      if(this.clocks[this.clockColor]<=0){
        this.clocks[this.clockColor]=0;this._renderClocks();this._stopClocks();
        this._gameOver({type:'timeout',winner:this.clockColor==='w'?'b':'w'});return;
      }
      this._renderClocks();
    },250);
  }
  _stopClocks(){if(this.clockTimer){clearInterval(this.clockTimer);this.clockTimer=null;}}
}

const app=new App();
document.addEventListener('DOMContentLoaded',()=>app.init());
