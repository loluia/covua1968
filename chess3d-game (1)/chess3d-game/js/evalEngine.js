class EvalEngine extends EventEmitter{
  constructor(depth=12){super();this.ready=false;this.busy=false;this.depth=depth;this.queuedFen=null;this.currentTurn='w';this._activeFen=null;this.worker=null;this._init();}
  _init(){
    loadWorkerFromURL(STOCKFISH_CDN_URL).then(w=>{
      this.worker=w;
      w.onmessage=e=>this._msg(typeof e.data==='string'?e.data:'');
      w.onerror=e=>{console.error(e);this.emit('error','Thanh đánh giá gặp lỗi.');};
      w.postMessage('uci');
    }).catch(e=>{console.error(e);this.emit('error','Không thể tải engine đánh giá.');});
  }
  _msg(line){
    if(line==='uciok'){this.worker.postMessage('isready');return;}
    if(line==='readyok'){this.ready=true;this.emit('ready');if(this.queuedFen){const f=this.queuedFen;this.queuedFen=null;this._start(f);}return;}
    if(line.startsWith('info'))this._parseInfo(line);
    if(line.startsWith('bestmove')){this.busy=false;if(this.queuedFen){const f=this.queuedFen;this.queuedFen=null;this._start(f);}}
  }
  _parseInfo(line){
    const dm=line.match(/\bdepth (\d+)/),cpm=line.match(/\bscore cp (-?\d+)/),mm=line.match(/\bscore mate (-?\d+)/);
    if(!cpm&&!mm)return;
    const sign=this.currentTurn==='w'?1:-1,depth=dm?parseInt(dm[1],10):null;
    let cp;
    if(mm){const mate=parseInt(mm[1],10)*sign;cp=mate>0?100000:-100000;this.emit('evaluation',{cp,mate,whiteWinProb:cpToWinProbability(clamp(cp,-1000,1000)),depth,fen:this._activeFen});return;}
    cp=parseInt(cpm[1],10)*sign;
    this.emit('evaluation',{cp,mate:null,whiteWinProb:cpToWinProbability(clamp(cp,-1000,1000)),depth,fen:this._activeFen});
  }
  _start(fen){this.busy=true;this._activeFen=fen;this.currentTurn=fen.split(' ')[1]||'w';this.worker.postMessage('position fen '+fen);this.worker.postMessage('go depth '+this.depth);}
  evaluate(fen){if(!this.ready){this.queuedFen=fen;return;}if(this.busy){this.queuedFen=fen;this.worker.postMessage('stop');return;}this._start(fen);}
  destroy(){if(this.worker){this.worker.terminate();this.worker=null;}}
}
