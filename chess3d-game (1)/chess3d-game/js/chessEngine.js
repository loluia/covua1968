class ChessEngine extends EventEmitter{
  constructor(){super();this.game=new Chess();this.captured={w:[],b:[]};}
  reset(fen){this.game=fen?new Chess(fen):new Chess();this.captured={w:[],b:[]};this.emit('reset',this.fen());}
  fen(){return this.game.fen();}
  turn(){return this.game.turn();}
  inCheck(){return this.game.in_check();}
  pieceAt(sq){return this.game.get(sq);}
  legalMovesFrom(sq){return this.game.moves({square:sq,verbose:true});}
  needsPromotion(from,to){
    const p=this.game.get(from);if(!p||p.type!=='p')return false;
    const r=to[1];return(p.color==='w'&&r==='8')||(p.color==='b'&&r==='1');
  }
  move(from,to,promotion){
    const att={from,to};if(promotion)att.promotion=promotion;
    const r=this.game.move(att);if(!r)return null;
    if(r.captured)this.captured[r.color].push(r.captured);
    this.emit('move',{move:r,fen:this.fen(),captured:this.captured});
    if(this.game.in_check()&&!this.game.game_over())this.emit('check',this.turn());
    if(this.game.game_over())this.emit('gameOver',this.getGameOverInfo());
    return r;
  }
  moveUCI(uci){return this.move(uci.slice(0,2),uci.slice(2,4),uci.length>4?uci[4]:undefined);}
  undo(){
    const u=this.game.undo();
    if(u&&u.captured){const l=this.captured[u.color],i=l.lastIndexOf(u.captured);if(i!==-1)l.splice(i,1);}
    if(u)this.emit('undo',this.fen());return u;
  }
  history(){return this.game.history({verbose:true});}
  isGameOver(){return this.game.game_over();}
  getGameOverInfo(){
    if(this.game.in_checkmate())return{type:'checkmate',winner:this.turn()==='w'?'b':'w'};
    if(this.game.in_stalemate())return{type:'stalemate',winner:null};
    if(this.game.in_threefold_repetition())return{type:'repetition',winner:null};
    if(this.game.insufficient_material())return{type:'insufficient',winner:null};
    if(this.game.in_draw())return{type:'fifty-move',winner:null};
    return{type:'draw',winner:null};
  }
  boardSnapshot(){
    const out=[];const board=this.game.board();
    for(let r=0;r<8;r++)for(let f=0;f<8;f++){
      const c=board[r][f];if(!c)continue;
      const rank=8-r;out.push({square:FILES[f]+rank,type:c.type,color:c.color});
    }
    return out;
  }
}
