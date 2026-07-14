const PIECE_MAT={
  w:new THREE.MeshStandardMaterial({color:0xefe4c8,roughness:.5,metalness:.06}),
  b:new THREE.MeshStandardMaterial({color:0x241712,roughness:.55,metalness:.08}),
};
const BRASS_MAT=new THREE.MeshStandardMaterial({color:0xc9a24c,roughness:.35,metalness:.65});
const BODY_PROF=[[0,0],[.34,0],[.34,.045],[.205,.09],[.225,.11],[.165,.15],[.15,.43],[.15,.46],[.205,.5],[.23,.52],[.16,.545],[.15,.56]];
function latheBody(hs,rs,mat){
  const pts=BODY_PROF.map(([r,y])=>new THREE.Vector2(r*rs,y*hs));
  const g=new THREE.LatheGeometry(pts,20);g.computeVertexNormals();return new THREE.Mesh(g,mat);
}
function bRing(y,r,t=.018){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,10,28),BRASS_MAT);m.rotation.x=Math.PI/2;m.position.y=y;return m;}
function hPawn(mat,top){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.SphereGeometry(.165,18,14),mat);b.position.y=top+.13;g.add(b);return g;}
function hRook(mat,top){
  const g=new THREE.Group();const d=new THREE.Mesh(new THREE.CylinderGeometry(.245,.225,.2,18),mat);d.position.y=top+.1;g.add(d);
  for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;const t=new THREE.Mesh(new THREE.BoxGeometry(.085,.1,.085),mat);t.position.set(Math.cos(a)*.2,top+.245,Math.sin(a)*.2);g.add(t);}
  g.add(bRing(top+.005,.225,.014));return g;
}
function hBishop(mat,top){
  const g=new THREE.Group();const m=new THREE.Mesh(new THREE.ConeGeometry(.165,.38,18),mat);m.position.y=top+.19;g.add(m);
  const tp=new THREE.Mesh(new THREE.SphereGeometry(.06,12,10),mat);tp.position.y=top+.4;g.add(tp);g.add(bRing(top+.015,.155,.013));return g;
}
function hKnight(mat,top,f){
  const g=new THREE.Group();
  const nk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.3,14),mat);nk.position.y=top+.15;nk.rotation.x=f*.45;g.add(nk);
  const hd=new THREE.Mesh(new THREE.BoxGeometry(.2,.18,.36),mat);hd.position.set(0,top+.34,f*.155);hd.rotation.x=f*.5;g.add(hd);
  const mz=new THREE.Mesh(new THREE.ConeGeometry(.1,.22,10),mat);mz.position.set(0,top+.27,f*.34);mz.rotation.x=f*(Math.PI/2+.5);g.add(mz);
  const e=new THREE.Mesh(new THREE.ConeGeometry(.05,.14,8),mat);e.position.set(.07,top+.46,f*.02);e.rotation.z=-.25;g.add(e);
  const e2=e.clone();e2.position.x=-.07;e2.rotation.z=.25;g.add(e2);
  g.add(bRing(top+.005,.205,.014));return g;
}
function hQueen(mat,top){
  const g=new THREE.Group();const o=new THREE.Mesh(new THREE.SphereGeometry(.195,20,16),mat);o.position.y=top+.18;g.add(o);
  g.add(bRing(top+.08,.195,.016));
  for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;const s=new THREE.Mesh(new THREE.ConeGeometry(.045,.16,8),mat);s.position.set(Math.cos(a)*.165,top+.34,Math.sin(a)*.165);g.add(s);}
  const c=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8),mat);c.position.y=top+.42;g.add(c);return g;
}
function hKing(mat,top){
  const g=new THREE.Group();const o=new THREE.Mesh(new THREE.SphereGeometry(.205,20,16),mat);o.position.y=top+.19;g.add(o);
  g.add(bRing(top+.09,.205,.017));
  const cv=new THREE.Mesh(new THREE.BoxGeometry(.05,.26,.05),BRASS_MAT);cv.position.y=top+.5;g.add(cv);
  const ch=new THREE.Mesh(new THREE.BoxGeometry(.17,.05,.05),BRASS_MAT);ch.position.y=top+.46;g.add(ch);return g;
}
const PSPEC={
  p:{h:.62,r:.78,head:(m,t)=>hPawn(m,t)},r:{h:.74,r:1,head:(m,t)=>hRook(m,t)},
  b:{h:.88,r:.86,head:(m,t)=>hBishop(m,t)},n:{h:.8,r:.9,head:(m,t,f)=>hKnight(m,t,f)},
  q:{h:1.02,r:.94,head:(m,t)=>hQueen(m,t)},k:{h:1.1,r:.96,head:(m,t)=>hKing(m,t)},
};
function buildPieceMesh(type,color,facing){
  const sp=PSPEC[type],mat=PIECE_MAT[color],g=new THREE.Group();
  g.add(latheBody(sp.h,sp.r,mat));g.add(sp.head(mat,sp.h*.56,facing));
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  g.userData.pieceType=type;g.userData.pieceColor=color;return g;
}

class PieceManager{
  constructor(scene){this.scene=scene;this.bySquare=new Map();this.selectedSquare=null;}
  _facing(c){return c==='w'?-1:1;}
  _place(sq,type,color){
    const m=buildPieceMesh(type,color,this._facing(color));
    const{x,z}=squareToWorld(sq);m.position.set(x,BOARD_SURFACE_Y,z);
    this.scene.add(m);this.bySquare.set(sq,m);return m;
  }
  clearAll(){for(const m of this.bySquare.values())this.scene.remove(m);this.bySquare.clear();}
  syncWithBoard(snap){this.clearAll();for(const{square,type,color}of snap)this._place(square,type,color);}
  meshAt(sq){return this.bySquare.get(sq);}
  removeAt(sq,{animate=true}={}){
    const m=this.bySquare.get(sq);if(!m)return;this.bySquare.delete(sq);
    if(!animate){this.scene.remove(m);return;}
    gsap.to(m.position,{y:BOARD_SURFACE_Y-.9,duration:.35,ease:'power1.in'});
    gsap.to(m.rotation,{z:Math.PI/2.2,duration:.35,ease:'power1.in'});
    gsap.to(m.scale,{x:.001,y:.001,z:.001,duration:.3,delay:.05,ease:'power1.in',onComplete:()=>this.scene.remove(m)});
  }
  animateMove(from,to,extra={},onComplete){
    const m=this.bySquare.get(from);if(!m){if(onComplete)onComplete();return;}
    if(extra.capturedSquare)this.removeAt(extra.capturedSquare,{animate:true});
    if(this.bySquare.has(to)&&to!==from)this.removeAt(to,{animate:false});
    this.bySquare.delete(from);this.bySquare.set(to,m);
    const{x,z}=squareToWorld(to),lh=BOARD_SURFACE_Y+.55;
    const tl=gsap.timeline({onComplete});
    tl.to(m.position,{y:lh,duration:.16,ease:'power1.out'},0);
    tl.to(m.position,{x,z,duration:.34,ease:'power2.inOut'},.02);
    tl.to(m.position,{y:BOARD_SURFACE_Y,duration:.16,ease:'power1.in'},.34);
    if(extra.rookFrom&&extra.rookTo){
      const rm=this.bySquare.get(extra.rookFrom);
      if(rm){this.bySquare.delete(extra.rookFrom);this.bySquare.set(extra.rookTo,rm);
        const rp=squareToWorld(extra.rookTo);
        tl.to(rm.position,{y:lh,duration:.16,ease:'power1.out'},0);
        tl.to(rm.position,{x:rp.x,z:rp.z,duration:.34,ease:'power2.inOut'},.02);
        tl.to(rm.position,{y:BOARD_SURFACE_Y,duration:.16,ease:'power1.in'},.34);
      }
    }
    return tl;
  }
  promoteAt(sq,newType,color){
    const old=this.bySquare.get(sq);if(old)this.scene.remove(old);
    const m=buildPieceMesh(newType,color,this._facing(color));
    const{x,z}=squareToWorld(sq);m.position.set(x,BOARD_SURFACE_Y-.3,z);m.scale.set(.001,.001,.001);
    this.scene.add(m);this.bySquare.set(sq,m);
    gsap.to(m.position,{y:BOARD_SURFACE_Y,duration:.3,ease:'back.out(1.7)'});
    gsap.to(m.scale,{x:1,y:1,z:1,duration:.3,ease:'back.out(1.7)'});
  }
  setSelected(sq){
    this.clearSelected();const m=this.bySquare.get(sq);if(!m)return;
    this.selectedSquare=sq;gsap.to(m.position,{y:BOARD_SURFACE_Y+.1,duration:.18,ease:'power2.out'});
  }
  clearSelected(){
    if(!this.selectedSquare)return;
    const m=this.bySquare.get(this.selectedSquare);
    if(m)gsap.to(m.position,{y:BOARD_SURFACE_Y,duration:.18,ease:'power2.in'});
    this.selectedSquare=null;
  }
}
