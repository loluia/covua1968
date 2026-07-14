const SQUARE_SIZE=1.0,BOARD_HALF=(SQUARE_SIZE*8)/2,BOARD_SURFACE_Y=0.05;
const FILES=['a','b','c','d','e','f','g','h'];
function squareToIndices(sq){return{file:FILES.indexOf(sq[0]),rank:parseInt(sq[1],10)-1};}
function indicesToSquare(f,r){return FILES[f]+(r+1);}
function squareToWorld(sq){const{file,rank}=squareToIndices(sq);return{x:(file-3.5)*SQUARE_SIZE,z:(3.5-rank)*SQUARE_SIZE};}
function isLightSquare(sq){const{file,rank}=squareToIndices(sq);return(file+rank)%2===1;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function generateRoomCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let o='';for(let i=0;i<6;i++)o+=c[Math.floor(Math.random()*c.length)];return'CHESS3D-'+o;}
const PIECE_GLYPH={w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
function pieceValue(t){return{p:1,n:3,b:3,r:5,q:9,k:0}[t]||0;}
function cpToWinProbability(cp){return 1/(1+Math.exp(-0.00368208*cp));}

class EventEmitter{
  constructor(){this._l={};}
  on(e,fn){(this._l[e]=this._l[e]||[]).push(fn);return this;}
  off(e,fn){if(!this._l[e])return this;this._l[e]=this._l[e].filter(f=>f!==fn);return this;}
  emit(e,...a){(this._l[e]||[]).forEach(fn=>{try{fn(...a);}catch(err){console.error(err);}});}
}

let _toastTimer=null;
function showToast(msg,ms=2600){
  const el=document.getElementById('toast');if(!el)return;
  el.textContent=msg;el.classList.add('show');
  clearTimeout(_toastTimer);_toastTimer=setTimeout(()=>el.classList.remove('show'),ms);
}

async function loadWorkerFromURL(url){
  const res=await fetch(url,{mode:'cors'});
  if(!res.ok)throw new Error(`HTTP ${res.status} fetching ${url}`);
  const blob=new Blob([await res.text()],{type:'application/javascript'});
  const burl=URL.createObjectURL(blob);
  const w=new Worker(burl);
  URL.revokeObjectURL(burl);
  return w;
}
