const STOCKFISH_CDN_URL='https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';
const BOT_PRESETS={1:{skill:1,mt:250},5:{skill:5,mt:500},10:{skill:10,mt:900},15:{skill:15,mt:1500},20:{skill:20,mt:2500}};
class StockfishBot extends EventEmitter{
  constructor(){super();this.ready=false;this.thinking=false;this.skill=10;this.mt=900;this._res=null;this.worker=null;this._init();}
  _init(){
    loadWorkerFromURL(STOCKFISH_CDN_URL).then(w=>{
      this.worker=w;
      w.onmessage=e=>this._msg(typeof e.data==='string'?e.data:'');
      w.onerror=e=>{console.error(e);this.emit('error','Bot gặp lỗi.');};
      this._send('uci');
    }).catch(e=>{console.error(e);this.emit('error','Không thể tải Stockfish (Bot).');});
  }
  _send(cmd){if(this.worker)this.worker.postMessage(cmd);}
  setDifficulty(lv){const p=BOT_PRESETS[lv]||BOT_PRESETS[10];this.skill=p.skill;this.mt=p.mt;if(this.ready){this._send('setoption name Skill Level value '+this.skill);this._send('setoption name UCI_LimitStrength value true');}}
  _msg(line){
    if(line==='uciok'){this._send('setoption name Skill Level value '+this.skill);this._send('setoption name UCI_LimitStrength value true');this._send('isready');return;}
    if(line==='readyok'){this.ready=true;this.emit('ready');return;}
    if(line.startsWith('bestmove')){const uci=line.split(' ')[1];this.thinking=false;if(this._res){const r=this._res;this._res=null;r(uci==='(none)'?null:uci);}this.emit('bestmove',uci);}
  }
  requestMove(fen){return new Promise(res=>{if(!this.worker){res(null);return;}this.thinking=true;this._res=res;this._send('position fen '+fen);this._send('go movetime '+this.mt);});}
  newGame(){this._send('ucinewgame');}
  destroy(){if(this.worker){this.worker.terminate();this.worker=null;}}
}
