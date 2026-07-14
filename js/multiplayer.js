class MultiplayerSession extends EventEmitter{
  constructor(){super();this.peer=null;this.conn=null;this.role=null;this.roomCode=null;this._attempts=0;}
  createRoom(){this._attempts=0;this._tryCreate();}
  _tryCreate(){
    this.roomCode=generateRoomCode();this._destroy();
    this.peer=new Peer(this.roomCode);
    this.peer.on('open',id=>{this.role='host';this.emit('roomCreated',id);});
    this.peer.on('connection',incoming=>{this.conn=incoming;this._wire();});
    this.peer.on('error',err=>{
      const msg=String(err&&err.type||err);
      if(msg.includes('unavailable-id')&&this._attempts<4){this._attempts++;this._tryCreate();return;}
      this.emit('error','Không thể tạo phòng: '+msg);
    });
    this.peer.on('disconnected',()=>this.emit('brokerDisconnected'));
  }
  joinRoom(code){
    this._destroy();this.peer=new Peer();
    this.peer.on('open',()=>{this.role='guest';this.conn=this.peer.connect(code.trim().toUpperCase(),{reliable:true});this._wire();});
    this.peer.on('error',err=>{
      const msg=String(err&&err.type||err);
      if(msg.includes('peer-unavailable'))this.emit('joinFailed','Không tìm thấy phòng.');
      else this.emit('error','Lỗi: '+msg);
    });
    this.peer.on('disconnected',()=>this.emit('brokerDisconnected'));
  }
  _wire(){
    this.conn.on('open',()=>this.emit('peerConnected',this.role));
    this.conn.on('data',d=>this.emit('message',d));
    this.conn.on('close',()=>this.emit('peerDisconnected'));
    this.conn.on('error',e=>this.emit('error','Lỗi đường truyền: '+e));
  }
  send(payload){if(this.conn&&this.conn.open){this.conn.send(payload);return true;}return false;}
  isConnected(){return!!(this.conn&&this.conn.open);}
  _destroy(){if(this.peer){try{this.peer.destroy();}catch(e){}}this.peer=null;this.conn=null;}
  destroy(){this._destroy();this.role=null;this.roomCode=null;}
}
