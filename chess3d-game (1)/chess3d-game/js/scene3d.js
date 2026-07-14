class SceneManager{
  constructor(canvas){
    this.canvas=canvas;this.holder=canvas.parentElement;this.flipped=false;
    this.scene=new THREE.Scene();this._buildLights();this._buildCamera();this._buildRenderer();
    this.worldRoot=new THREE.Group();this.scene.add(this.worldRoot);
    this.boardTiles=[];this._buildBoard();this._buildLabels();
    this.legalMarkers=[];this.selectedOverlay=null;this.lastMoveOverlays=[];this.checkOverlay=null;
    this._buildControls();this._bindResize();this._tick();
  }
  _buildLights(){
    this.scene.add(new THREE.HemisphereLight(0xfff3d6,0x2a1c12,.55));
    const key=new THREE.DirectionalLight(0xfff0d2,1.15);
    key.position.set(4.5,8,3.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
    key.shadow.camera.near=1;key.shadow.camera.far=20;
    key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;
    key.shadow.bias=-.0015;this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xcfe0ff,.28);fill.position.set(-5,4,-4);this.scene.add(fill);
  }
  _buildCamera(){this.camera=new THREE.PerspectiveCamera(42,1,.1,100);this.camera.position.set(0,7.6,6.6);this.camera.lookAt(0,0,0);}
  _buildRenderer(){
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false});
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    if(THREE.sRGBEncoding)this.renderer.outputEncoding=THREE.sRGBEncoding;
    if(THREE.ACESFilmicToneMapping)this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.05;this.renderer.setClearColor(0x100d0a,1);this.resize();
  }
  _buildBoard(){
    const lm=new THREE.MeshStandardMaterial({color:0xe8dcc2,roughness:.72,metalness:.02});
    const dm=new THREE.MeshStandardMaterial({color:0x4a2f1d,roughness:.65,metalness:.02});
    const tg=new THREE.BoxGeometry(SQUARE_SIZE*.985,.1,SQUARE_SIZE*.985);
    for(const f of FILES)for(let rk=1;rk<=8;rk++){
      const sq=f+rk,mat=isLightSquare(sq)?lm:dm,tile=new THREE.Mesh(tg,mat);
      const{x,z}=squareToWorld(sq);tile.position.set(x,0,z);tile.receiveShadow=true;
      tile.userData.square=sq;tile.userData.isBoardTile=true;this.worldRoot.add(tile);this.boardTiles.push(tile);
    }
    const rim=new THREE.Mesh(new THREE.BoxGeometry(SQUARE_SIZE*8+.7,.22,SQUARE_SIZE*8+.7),
      new THREE.MeshStandardMaterial({color:0x2a1b10,roughness:.6,metalness:.04}));
    rim.position.y=-.13;rim.receiveShadow=true;this.worldRoot.add(rim);
    const tmat=new THREE.MeshStandardMaterial({color:0xc9a24c,roughness:.3,metalness:.7});
    const tgeo=new THREE.BoxGeometry(SQUARE_SIZE*8+.74,.03,.045),half=SQUARE_SIZE*4+.365;
    [[0,half],[0,-half]].forEach(([x,z])=>{const t=new THREE.Mesh(tgeo,tmat);t.position.set(x,-.015,z);this.worldRoot.add(t);});
    [[half,0,Math.PI/2],[-half,0,Math.PI/2]].forEach(([x,z,ry])=>{const t=new THREE.Mesh(tgeo,tmat);t.position.set(x,-.015,z);t.rotation.y=ry;this.worldRoot.add(t);});
  }
  _makeTextSprite(text){
    const s=64,cv=document.createElement('canvas');cv.width=s;cv.height=s;
    const ctx=cv.getContext('2d');ctx.font='600 38px Inter,sans-serif';ctx.fillStyle='rgba(232,221,196,.82)';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,s/2,s/2+2);
    const tex=new THREE.CanvasTexture(cv);tex.minFilter=THREE.LinearFilter;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
    sp.scale.set(.32,.32,.32);return sp;
  }
  _buildLabels(){
    this.labelGroup=new THREE.Group();const edge=SQUARE_SIZE*4+.3;
    FILES.forEach((f,i)=>{const x=(i-3.5)*SQUARE_SIZE,s=this._makeTextSprite(f);s.position.set(x,.02,edge);this.labelGroup.add(s);});
    for(let r=1;r<=8;r++){const z=(3.5-(r-1))*SQUARE_SIZE,s=this._makeTextSprite(String(r));s.position.set(-edge,.02,z);this.labelGroup.add(s);}
    this.worldRoot.add(this.labelGroup);
  }
  _buildControls(){
    this.controls=new THREE.OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.enablePan=false;
    this.controls.minDistance=5.5;this.controls.maxDistance=13;
    this.controls.maxPolarAngle=Math.PI/2.08;this.controls.minPolarAngle=Math.PI/7;this.controls.target.set(0,0,0);
  }
  _bindResize(){const ro=new ResizeObserver(()=>this.resize());ro.observe(this.holder);window.addEventListener('resize',()=>this.resize());}
  resize(){
    const w=this.holder.clientWidth||600,h=this.holder.clientHeight||600;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));this.renderer.setSize(w,h,false);
    if(this.camera){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  }
  flipBoard(){this.flipped=!this.flipped;gsap.to(this.worldRoot.rotation,{y:this.flipped?Math.PI:0,duration:.85,ease:'power3.inOut'});}
  _overlay(sq,color,opacity){
    const{x,z}=squareToWorld(sq);
    const m=new THREE.Mesh(new THREE.BoxGeometry(SQUARE_SIZE*.985,.012,SQUARE_SIZE*.985),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity}));
    m.position.set(x,BOARD_SURFACE_Y+.007,z);this.worldRoot.add(m);return m;
  }
  setSelectedSquare(sq){this.clearSelectedSquare();if(sq)this.selectedOverlay=this._overlay(sq,0xc9a24c,.45);}
  clearSelectedSquare(){if(this.selectedOverlay){this.worldRoot.remove(this.selectedOverlay);this.selectedOverlay=null;}}
  setLegalMarkers(moves){
    this.clearLegalMarkers();
    for(const mv of moves){
      const{x,z}=squareToWorld(mv.to);const isCapture=!!mv.captured||mv.flags.includes('e');let m;
      if(isCapture){m=new THREE.Mesh(new THREE.RingGeometry(.36,.46,24),new THREE.MeshBasicMaterial({color:0xc1564a,transparent:true,opacity:.85,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;}
      else{m=new THREE.Mesh(new THREE.CircleGeometry(.15,20),new THREE.MeshBasicMaterial({color:0xc9a24c,transparent:true,opacity:.75,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;}
      m.position.set(x,BOARD_SURFACE_Y+.02,z);this.worldRoot.add(m);this.legalMarkers.push(m);
    }
  }
  clearLegalMarkers(){for(const m of this.legalMarkers)this.worldRoot.remove(m);this.legalMarkers=[];}
  setLastMove(from,to){this.clearLastMove();this.lastMoveOverlays.push(this._overlay(from,0xc9a24c,.28));this.lastMoveOverlays.push(this._overlay(to,0xc9a24c,.28));}
  clearLastMove(){for(const m of this.lastMoveOverlays)this.worldRoot.remove(m);this.lastMoveOverlays=[];}
  setCheckSquare(sq){this.clearCheckSquare();if(sq)this.checkOverlay=this._overlay(sq,0xc1564a,.55);}
  clearCheckSquare(){if(this.checkOverlay){this.worldRoot.remove(this.checkOverlay);this.checkOverlay=null;}}
  getPointerNDC(cx,cy){const r=this.canvas.getBoundingClientRect();return{x:((cx-r.left)/r.width)*2-1,y:-((cy-r.top)/r.height)*2+1};}
  raycastFirst(ndc,objs,rec=true){if(!this._rc)this._rc=new THREE.Raycaster();this._rc.setFromCamera(ndc,this.camera);const h=this._rc.intersectObjects(objs,rec);return h.length?h[0]:null;}
  _tick(){requestAnimationFrame(()=>this._tick());this.controls.update();this.renderer.render(this.scene,this.camera);}
}
