'use client';

import { useEffect, useRef } from 'react';
import type { Group, Object3D, Mesh, Material, WebGLRenderer, Scene, PerspectiveCamera, Vector3 } from 'three';

import { COURT, isServeMode, serviceBoxes, type CourtMode } from '../lib/court';

type View = 'angle' | 'top';
type SceneProps = {
  mode: CourtMode;
  score: number;
  view: View;
  paused: boolean;
  onReady: () => void;
  onError: () => void;
};
type Puppet = { body: Group; rightArm: Group; leftArm: Group; rightLeg: Group; leftLeg: Group };

/** Rally Guide V12.3: procedural shuttle and anatomically connected racket grip. */
export function CourtArenaScene(props: SceneProps) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const notify = useRef({ onReady: props.onReady, onError: props.onError });
  const isIntersecting = useRef(true);
  // Cập nhật sau mỗi lần render (không ghi ref trong lúc render); vòng vẽ luôn đọc giá trị mới nhất.
  useEffect(() => {
    latest.current = props;
    notify.current = { onReady: props.onReady, onError: props.onError };
  });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let alive = true;
    let raf = 0;
    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let camera: PerspectiveCamera | null = null;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    let onVisibility = () => {};
    let removeDrag = () => {};
    let onContextLost = (_e: Event) => {};

    void (async () => {
      try {
        const T = await import('three');
        if (!alive) return;
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.touchAction = 'pan-y';
        onContextLost = (event: Event) => { event.preventDefault(); notify.current.onError(); };
        canvas.addEventListener('webglcontextlost', onContextLost, false);
        el.appendChild(canvas);
        // WebGL fails here on unsupported devices and the parent switches to SVG fallback.
        const gl = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
        renderer = gl;
        gl.setClearColor('#052c20', 0);
        gl.outputColorSpace = T.SRGBColorSpace;
        gl.toneMapping = T.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.4;
        gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 680 ? 1.25 : 1.65));
        gl.shadowMap.enabled = window.innerWidth >= 900;
        gl.shadowMap.type = T.PCFSoftShadowMap;

        const stage = new T.Scene();
        scene = stage;
        stage.fog = new T.FogExp2('#072d22', 0.016);
        const cam = new T.PerspectiveCamera(36, 1, 0.1, 110);
        camera = cam;
        stage.add(new T.HemisphereLight('#dffff1', '#103a2a', 2.2));
        const sun = new T.DirectionalLight('#ffffff', 3.0);
        sun.position.set(-5, 13, 6);
        sun.castShadow = gl.shadowMap.enabled;
        sun.shadow.mapSize.set(1024,1024);
        sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
        sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
        sun.shadow.normalBias = 0.02;
        stage.add(sun);
        const rim = new T.DirectionalLight('#5af4be', 2.1);
        rim.position.set(6, 6, -10);
        stage.add(rim);

        const green = new T.MeshStandardMaterial({ color:'#05734b', roughness:.77, metalness:.06 });
        const surround = new T.MeshStandardMaterial({ color:'#073c2c', roughness:.94, metalness:0 });
        const boundary = new T.MeshStandardMaterial({ color:'#e9fff4', roughness:.6, emissive:'#5b957c', emissiveIntensity:.13 });
        const tape = new T.MeshStandardMaterial({color:'#f7fff7', roughness:.6});
        const pad = new T.Mesh(new T.BoxGeometry(24,.12,28), surround);
        pad.position.y = -0.12;
        pad.receiveShadow = true;
        stage.add(pad);
        const field = new T.Mesh(new T.BoxGeometry(COURT.width,.055,COURT.length), green);
        field.position.y = -.027;
        field.receiveShadow = true;
        stage.add(field);
        const line = (x1:number,z1:number,x2:number,z2:number,weight=.044) => {
          const cx=(x1+x2)/2, cz=(z1+z2)/2;
          const length=Math.hypot(x2-x1,z2-z1);
          const mesh=new T.Mesh(new T.BoxGeometry(weight,.012,length),boundary);
          mesh.position.set(cx,.023,cz);
          mesh.rotation.y = Math.atan2(x2-x1,z2-z1);
          stage.add(mesh);
        };
        const W=COURT.width/2, L=COURT.length/2;
        // Court dimensions: singles sidelines 0.46m inside, doubles long service 0.76m inside.
        for (const x of [-W,W,-W+COURT.sideAlley,W-COURT.sideAlley]) line(x,-L,x,L);
        for (const z of [-L,L,-L+COURT.doublesLong,L-COURT.doublesLong,-COURT.shortService,COURT.shortService]) line(-W,z,W,z);
        line(0,-L,0,-COURT.shortService); line(0,COURT.shortService,0,L);

        // Actual net mesh built from fine horizontal and vertical threads.
        const poleMat=new T.MeshStandardMaterial({color:'#dfe8e6',metalness:.55,roughness:.36});
        for(const x of [-W-.035,W+.035]) {
          const pole=new T.Mesh(new T.CylinderGeometry(.035,.05,1.63,10),poleMat);
          pole.position.set(x,.815,0);pole.castShadow=true;stage.add(pole);
        }
        const netThread=new T.LineBasicMaterial({color:'#d4e9e2',transparent:true,opacity:.46});
        const netLines:number[]=[];
        for(let x=-W; x<=W+.0001;x+=.19)netLines.push(x,.09,0,x,1.52,0);
        for(let y=.1;y<=1.5;y+=.18)netLines.push(-W,y,0,W,y,0);
        const netGeometry=new T.BufferGeometry();
        netGeometry.setAttribute('position',new T.Float32BufferAttribute(netLines,3));
        stage.add(new T.LineSegments(netGeometry,netThread));
        const topTape=new T.Mesh(new T.BoxGeometry(COURT.width+.1,.048,.045),tape);
        topTape.position.set(0,1.53,0);stage.add(topTape);

        // Court highlight overlays, using the same rules as the site's original SVG.
        const highlightMat=new T.MeshBasicMaterial({color:'#acff73',transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide});
        const markMat=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.15,depthWrite:false,side:T.DoubleSide});
        const shadeMat=new T.MeshBasicMaterial({color:'#00180f',transparent:true,opacity:.44,depthWrite:false,side:T.DoubleSide});
        const sheet=new T.PlaneGeometry(1,1);
        const serverOverlay=new T.Mesh(sheet,markMat), targetOverlay=new T.Mesh(sheet,highlightMat);
        const offsideLeft=new T.Mesh(sheet,shadeMat), offsideRight=new T.Mesh(sheet,shadeMat);
        const overlays=[serverOverlay,targetOverlay,offsideLeft,offsideRight];
        overlays.forEach((m)=>{m.rotation.x=-Math.PI/2;m.position.y=.041;stage.add(m);});
        const setRect=(m:Mesh,r:{x:number;y:number;w:number;h:number})=>{
          // Court rules: x is length from 0 to 13.4, y is width from 0 to 6.1.
          m.position.x=r.y+r.h/2-W;
          m.position.z=r.x+r.w/2-L;
          m.scale.set(r.h,r.w,1);
        };

        const skin=new T.MeshStandardMaterial({color:'#eab68e',roughness:.8});
        const blackHair=new T.MeshStandardMaterial({color:'#151c21',roughness:1});
        const shoe=new T.MeshStandardMaterial({color:'#e9f0ed',roughness:.7});
        const shortMat=new T.MeshStandardMaterial({color:'#17262a',roughness:.8});
        const shirtA=new T.MeshStandardMaterial({color:'#e31837',roughness:.75});
        const shirtB=new T.MeshStandardMaterial({color:'#b8f55d',roughness:.75});
        const handleMat=new T.MeshStandardMaterial({color:'#111717',metalness:.3,roughness:.6});
        const racketA=new T.MeshStandardMaterial({color:'#101e1c',metalness:.48,roughness:.4});
        const racketB=new T.MeshStandardMaterial({color:'#e7e7e7',metalness:.42,roughness:.38});
        const stringMat=new T.LineBasicMaterial({color:'#f9fff9',transparent:true,opacity:.66});
        const add=(parent:Group, geometry:object, material:Material, pos:[number,number,number], cast=true) => {
          const mesh=new T.Mesh(geometry as ConstructorParameters<typeof T.Mesh>[0],material);
          mesh.position.set(...pos);
          mesh.castShadow=cast;
          parent.add(mesh);
          return mesh;
        };
        const limb=(group:Group,from:[number,number,number],to:[number,number,number],radius:number,material:Material) => {
          const a=new T.Vector3(...from),b=new T.Vector3(...to);
          const m=add(group,new T.CylinderGeometry(radius*.94,radius,a.distanceTo(b),10),material,[(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2]);
          m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());
          return m;
        };

        function createPlayer(color:Material, frameMat:Material):Puppet {
          const root=new T.Group(), person=new T.Group();
          root.add(person);stage.add(root);
          add(person,new T.CylinderGeometry(.28,.23,.6,12),color,[0,1.13,0]);
          add(person,new T.CylinderGeometry(.25,.25,.27,12),shortMat,[0,.78,0]);
          add(person,new T.SphereGeometry(.185,16,12),skin,[0,1.67,0]);
          add(person,new T.SphereGeometry(.192,16,12,0,Math.PI*2,0,Math.PI*.35),blackHair,[0,1.746,0]);
          add(person,new T.CylinderGeometry(.09,.11,.22,10),skin,[0,1.46,0]);
          const leftLeg=new T.Group(), rightLeg=new T.Group();
          leftLeg.position.set(-.13,.73,0);rightLeg.position.set(.13,.73,0);
          person.add(leftLeg,rightLeg);
          for(const [g,x] of [[leftLeg,-.09],[rightLeg,.09]] as const){
            limb(g,[0,0,0],[x,-.35,.12],.105,skin);
            limb(g,[x,-.35,.12],[x*1.5,-.67,.04],.072,skin);
            add(g,new T.BoxGeometry(.17,.11,.29),shoe,[x*1.5,-.68,.12]);
          }
          const leftArm=new T.Group(), rightArm=new T.Group();
          leftArm.position.set(-.27,1.34,0);rightArm.position.set(.27,1.34,0);
          person.add(leftArm,rightArm);
          limb(leftArm,[0,0,0],[-.16,-.3,.08],.075,skin);
          limb(leftArm,[-.16,-.3,.08],[-.18,-.48,.17],.055,skin);
          limb(rightArm,[0,0,0],[.17,-.23,.13],.075,skin);
          limb(rightArm,[.17,-.23,.13],[.31,-.41,.21],.053,skin);
          // The wrist ends exactly at the handle: no floating racket or gap at the grip.
          const wrist:[number,number,number]=[.31,-.41,.21];
          add(rightArm,new T.SphereGeometry(.07,12,10),skin,wrist);
          const racket=new T.Group();
          racket.position.set(...wrist);
          racket.rotation.set(-.2,0,-.48);
          rightArm.add(racket);

          // Handle (through the palm), narrow shaft, two-neck throat and oval head.
          const grip=new T.Mesh(new T.CylinderGeometry(.027,.03,.22,12),handleMat);
          grip.position.y=-.005;
          racket.add(grip);
          for(let i=0;i<5;i++){
            const wrap=add(racket,new T.TorusGeometry(.029,.0016,5,14),racketB,[0,-.09+i*.042,0],false);
            wrap.rotation.x=Math.PI/2;
          }
          limb(racket,[0,.102,0],[0,.315,0],.012,frameMat);
          limb(racket,[0,.302,0],[-.075,.375,0],.010,frameMat);
          limb(racket,[0,.302,0],[.075,.375,0],.010,frameMat);
          const headCenter=.605, headW=.195, headH=.264;
          const outline:Vector3[]=[];
          for(let i=0;i<64;i++){
            const angle=i/64*Math.PI*2;
            outline.push(new T.Vector3(Math.cos(angle)*headW,headCenter+Math.sin(angle)*headH,0));
          }
          add(racket,new T.TubeGeometry(new T.CatmullRomCurve3(outline,true),72,.012,7,true),frameMat,[0,0,0]);
          const strings:number[]=[];
          for(let x=-.175;x<=.176;x+=.043){
            const h=headH*Math.sqrt(Math.max(0,1-(x/headW)**2));
            strings.push(x,headCenter-h,0,x,headCenter+h,0);
          }
          for(let y=-.238;y<=.239;y+=.044){
            const w=headW*Math.sqrt(Math.max(0,1-(y/headH)**2));
            strings.push(-w,headCenter+y,0,w,headCenter+y,0);
          }
          const gStrings=new T.BufferGeometry();
          gStrings.setAttribute('position',new T.Float32BufferAttribute(strings,3));
          racket.add(new T.LineSegments(gStrings,stringMat));

          // Thumb plus curled fingers visibly wrap around the grip instead of hovering beside it.
          for(let i=0;i<4;i++){
            const finger=add(racket,new T.TorusGeometry(.032,.010,6,12,Math.PI*1.42),skin,[0,-.044+i*.026,0]);
            finger.rotation.set(Math.PI/2,0,.28);
          }
          const thumb=add(racket,new T.SphereGeometry(.026,10,8),skin,[.034,.059,.012]);
          thumb.scale.set(.9,1.65,.9);
          return {body:root,rightArm,leftArm,leftLeg,rightLeg};
        }
        const playerA=createPlayer(shirtA,racketA), playerB=createPlayer(shirtB,racketB);
        playerB.body.rotation.y=Math.PI;

        // Lightweight procedural feather shuttle: rounded cork, dark binding,
        // sixteen individual feather vanes and two fine strengthening rings.
        // Deliberately 1.3x the real-world scale so it remains legible on mobile.
        const shuttle=new T.Group();stage.add(shuttle);
        shuttle.scale.setScalar(1.3);
        const corkMat=new T.MeshStandardMaterial({color:'#f5e4c7',roughness:.93});
        const bandMat=new T.MeshStandardMaterial({color:'#203b30',roughness:.77});
        const featherMat=new T.MeshStandardMaterial({color:'#fffdf2',roughness:.9,side:T.DoubleSide});
        const ribMat=new T.MeshStandardMaterial({color:'#d8ded4',roughness:.82});
        add(shuttle,new T.SphereGeometry(.077,18,12),corkMat,[0,-.033,0]);
        add(shuttle,new T.CylinderGeometry(.077,.072,.082,18),corkMat,[0,.025,0]);
        add(shuttle,new T.CylinderGeometry(.082,.079,.024,18),bandMat,[0,.08,0]);

        const featherCount=16;
        for(let i=0;i<featherCount;i++){
          const a=i/featherCount*Math.PI*2;
          const radial=new T.Vector3(Math.cos(a),0,Math.sin(a));
          const tangent=new T.Vector3(-Math.sin(a),0,Math.cos(a));
          // The vanes flare away from the cork; unlike cones, the open rim is visible.
          const levels=[
            {y:.095,r:.064,w:.008},
            {y:.155,r:.10,w:.023},
            {y:.245,r:.149,w:.041},
            {y:.335,r:.203,w:.050},
            {y:.418,r:.242,w:.044},
          ];
          const vertices:number[]=[];
          for(const row of levels){
            for(const side of [-1,1]){
              const point=radial.clone().multiplyScalar(row.r).addScaledVector(tangent,side*row.w/2);
              vertices.push(point.x,row.y,point.z);
            }
          }
          const triangles:number[]=[];
          for(let j=0;j<levels.length-1;j++){
            const k=j*2;
            triangles.push(k,k+1,k+2,k+1,k+3,k+2);
          }
          const vaneGeo=new T.BufferGeometry();
          vaneGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
          vaneGeo.setIndex(triangles);
          vaneGeo.computeVertexNormals();
          add(shuttle,vaneGeo,featherMat,[0,0,0],false);
          const start=radial.clone().multiplyScalar(.067); start.y=.1;
          const end=radial.clone().multiplyScalar(.239); end.y=.417;
          limb(shuttle,[start.x,start.y,start.z],[end.x,end.y,end.z],.004,ribMat);
        }
        for(const [radius,height] of [[.138,.225],[.194,.326]] as const){
          const binding=add(shuttle,new T.TorusGeometry(radius,.0035,5,36),ribMat,[0,height,0],false);
          binding.rotation.x=Math.PI/2;
        }
        // The cork points into the direction of travel, feathers follow behind it.
        const flightAxis=new T.Vector3(0,-1,0);
        const flightDirection=new T.Vector3();
        const flightRotation=new T.Quaternion();
        const shuttleTrail=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,0,0),new T.Vector3(0,0,0)]),new T.LineBasicMaterial({color:'#d0ff9a',transparent:true,opacity:.38}));
        const trailPositions=shuttleTrail.geometry.getAttribute('position');
        stage.add(shuttleTrail);

        // High-angle overview on initial load. Desktop: drag to orbit. Mobile: buttons only.
        let azimuth=.72, elevation=.78;
        const camRadius=20;
        let targetAzimuth=.72, targetElevation=.78;
        let isDragging=false,lastX=0,lastY=0;
        const onDown=(e:PointerEvent)=>{if(e.pointerType!=='mouse'||e.button!==0)return;isDragging=true;lastX=e.clientX;lastY=e.clientY;canvas.style.cursor='grabbing';};
        const onMove=(e:PointerEvent)=>{if(!isDragging)return;targetAzimuth+=(e.clientX-lastX)*.006;targetElevation=Math.max(.4,Math.min(1.33,targetElevation+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY;};
        const onUp=()=>{isDragging=false;canvas.style.cursor='grab';};
        canvas.style.cursor='grab';
        canvas.addEventListener('pointerdown',onDown);window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);
        removeDrag=()=>{canvas.removeEventListener('pointerdown',onDown);window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);};

        const resize=()=>{
          const width=Math.max(1,el.clientWidth), height=Math.max(1,el.clientHeight);
          gl.setSize(width,height,false);
          cam.aspect=width/height;
          cam.fov=height>width ? 49 : 36;
          cam.updateProjectionMatrix();
        };
        resize();
        ro=new ResizeObserver(resize);ro.observe(el);
        io=new IntersectionObserver((events)=>{isIntersecting.current=events[0]?.isIntersecting??false;}, {threshold:.02});
        io.observe(el);
        onVisibility=()=>{if(!document.hidden)isIntersecting.current=true;};
        document.addEventListener('visibilitychange',onVisibility);
        let lastFrame=0,lastMode='', frozenTime=0;
        let lastTime=performance.now();
        const tick=(now:number)=>{
          if(!alive)return;
          raf=window.requestAnimationFrame(tick);
          if(document.hidden||!isIntersecting.current){lastTime=now;return;}
          // Avoid running the GPU at 60fps on mobile / low-powered devices.
          const minMs=window.innerWidth<680?34:17;
          if(now-lastFrame<minMs)return;
          const delta=Math.min((now-lastTime)/1000,.1); lastTime=now;lastFrame=now;
          const p=latest.current;
          const key=p.mode+':'+p.score;
          const serving=isServeMode(p.mode);
          const box=serviceBoxes(p.mode==='serve-doubles'||p.mode==='doubles'?'serve-doubles':'serve-singles',p.score);
          const toXZ=(r:{x:number;y:number;w:number;h:number},t=.5)=>({x:r.y+r.h*.5-W,z:r.x+r.w*t-L});
          if(lastMode!==key){
            lastMode=key;
            serverOverlay.visible=serving;targetOverlay.visible=serving;
            if(serving){setRect(serverOverlay,box.server);setRect(targetOverlay,box.target);}
            const singles=p.mode==='singles'||p.mode==='serve-singles';
            offsideLeft.visible=singles;offsideRight.visible=singles;
            if(singles){
              setRect(offsideLeft,{x:0,y:0,w:COURT.length,h:COURT.sideAlley});
              setRect(offsideRight,{x:0,y:COURT.width-COURT.sideAlley,w:COURT.length,h:COURT.sideAlley});
            }
          }
          const from=serving?toXZ(box.server,.64):{x:-.65,z:-3.5};
          const to=serving?toXZ(box.target,.36):{x:1,z:3.4};
          // Playback clock stops exactly when paused. On resume it advances from the frozen pose.
          // Reduced-motion is handled by the React control (initially paused),
          // so an explicit user Play action can always start the animation.
          if(!p.paused) frozenTime += delta;
          const play=frozenTime;
          const wave=Math.sin(play*4.4);
          playerA.body.position.set(from.x+wave*.18,0,from.z+.20*Math.cos(play*3.4));
          playerB.body.position.set(to.x-wave*.18,0,to.z+.20*Math.cos(play*3.4+2));
          playerA.rightArm.rotation.z=-.5+Math.sin(play*4.8)*1.05;
          playerB.rightArm.rotation.z=-.5+Math.sin(play*4.8+Math.PI)*1.05;
          playerA.rightArm.rotation.x=-.4+Math.sin(play*4.8)*.45;
          playerB.rightArm.rotation.x=-.4-Math.sin(play*4.8)*.45;
          playerA.leftArm.rotation.z=.1+Math.sin(play*2.3)*.15;
          playerB.leftArm.rotation.z=.1+Math.sin(play*2.3+Math.PI)*.15;
          playerA.leftLeg.rotation.x=Math.sin(play*3.4)*.22;
          playerB.leftLeg.rotation.x=-Math.sin(play*3.4)*.22;
          const phase=(play*.72)%2;
          const u=phase<1?phase:2-phase;
          shuttle.position.set(from.x+(to.x-from.x)*u,1.7+1.65*Math.sin(u*Math.PI),from.z+(to.z-from.z)*u);
          const directionSign=phase<1?1:-1;
          flightDirection.set(
            (to.x-from.x)*directionSign,
            1.65*Math.PI*Math.cos(u*Math.PI)*directionSign,
            (to.z-from.z)*directionSign,
          ).normalize();
          // Smoothly turn the cork into the flight path. Pause freezes the orientation too.
          if(!p.paused){
            flightRotation.setFromUnitVectors(flightAxis,flightDirection);
            shuttle.quaternion.slerp(flightRotation,Math.min(1,delta*10));
          }
          trailPositions.setXYZ(0,shuttle.position.x,shuttle.position.y,shuttle.position.z);
          const behind=flightDirection.clone().multiplyScalar(-.35);
          trailPositions.setXYZ(1,shuttle.position.x+behind.x,shuttle.position.y+behind.y,shuttle.position.z+behind.z);
          trailPositions.needsUpdate=true;
          const top=p.view==='top';
          const desiredA=top?0:targetAzimuth;
          const desiredE=top?1.53:targetElevation;
          azimuth+=(desiredA-azimuth)*.1;
          elevation+=(desiredE-elevation)*.1;
          const dist=top?21:camRadius;
          cam.position.set(dist*Math.sin(azimuth)*Math.cos(elevation),dist*Math.sin(elevation),dist*Math.cos(azimuth)*Math.cos(elevation));
          cam.lookAt(0,0,0);
          gl.render(stage,cam);
        };
        notify.current.onReady();
        raf=requestAnimationFrame(tick);
      } catch { if(alive) notify.current.onError(); }
    })();
    return ()=>{
      alive=false;
      cancelAnimationFrame(raf);
      ro?.disconnect();io?.disconnect();removeDrag();
      document.removeEventListener('visibilitychange',onVisibility);
      if(renderer){
        renderer.domElement.removeEventListener('webglcontextlost',onContextLost,false);
        renderer.dispose();
        if(renderer.domElement.parentElement===el)el.removeChild(renderer.domElement);
      }
      if(scene){
        scene.traverse((object:Object3D)=>{
          if('geometry' in object){const g=(object as Mesh).geometry;g?.dispose?.();}
          if('material' in object){const mats=(object as Mesh).material;for(const m of Array.isArray(mats)?mats:[mats])m?.dispose?.();}
        });
      }
      void camera;
    };
  }, []);
  return <div className="rga-three-host" ref={container} style={{ width:'100%',height:'100%',position:'relative' }} />;
}
