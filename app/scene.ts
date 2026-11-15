import "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3,Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import {plotPosition,type Player,type Plot,type Item} from "./types";

export async function createWorld(canvas:HTMLCanvasElement,onPick:(plot:number,x:number,z:number,item?:string)=>void){
  const engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false});
  engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.4));
  const scene=new Scene(engine);
  scene.clearColor=new Color4(.035,.023,.065,1);
  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.004;scene.fogColor=new Color3(.035,.023,.065);
  const camera=new ArcRotateCamera("camera",Math.PI/2,1.04,21,new Vector3(0,0,0),scene);
  camera.lowerBetaLimit=.35;camera.upperBetaLimit=1.4;camera.lowerRadiusLimit=8;camera.upperRadiusLimit=100;
  camera.attachControl(canvas,true);camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");camera.panningSensibility=0;camera.wheelPrecision=30;
  const light=new HemisphericLight("sky",new Vector3(.3,1,.4),scene);light.intensity=.85;
  const materials=new Map<string,StandardMaterial>();
  function material(color:string,glow=false){
    const key=color+glow;
    if(materials.has(key))return materials.get(key)!;
    const mat=new StandardMaterial(key,scene);mat.diffuseColor=Color3.FromHexString(color);mat.specularColor=new Color3(.12,.12,.12);
    if(glow)mat.emissiveColor=Color3.FromHexString(color).scale(.6);
    materials.set(key,mat);return mat;
  }
  function box(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,parent?:TransformNode,glow=false){
    const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
    mesh.position.set(x,y,z);mesh.material=material(color,glow);mesh.parent=parent??null;mesh.isPickable=false;return mesh;
  }
  function label(text:string,width:number,height:number,color="#f1e4ff"){
    const texture=new DynamicTexture("label",{width:512,height:128},scene,false);
    const ctx=texture.getContext() as CanvasRenderingContext2D;ctx.clearRect(0,0,512,128);ctx.fillStyle="#171023ee";ctx.fillRect(0,10,512,108);
    ctx.font="bold 32px sans-serif";ctx.textAlign="center";ctx.fillStyle=color;ctx.fillText(text.slice(0,36),256,78);texture.update();
    const mat=new StandardMaterial("label",scene);mat.diffuseTexture=texture;mat.emissiveColor=Color3.White();mat.disableLighting=true;mat.backFaceCulling=false;
    const mesh=MeshBuilder.CreatePlane("label",{width,height},scene);mesh.material=mat;mesh.isPickable=false;
    return {mesh,dispose:()=>{mesh.dispose();mat.dispose();texture.dispose();}};
  }
  box("ground",0,-.25,0,200,.4,200,"#171326");
  box("main path",0,-.01,0,180,.12,8,"#322642");
  box("cross path",0,.02,-1,6,.12,180,"#322642");
  for(let x=-88;x<=88;x+=8){box("path light",x,.08,4,1,.08,.12,"#67e5d1",undefined,true);box("path light",x,.08,-4,1,.08,.12,"#d07aff",undefined,true);}
  // The roofless club keeps the camera and touch navigation unobstructed.
  box("club",0,.08,-10,24,.22,15,"#251c36");
  box("back wall",0,2,-17.5,24,4,.4,"#1c142b");
  box("stage",0,.5,-15,9,.6,3,"#523365");
  box("desk",0,1.25,-14.4,5,1,1,"#171323");
  box("desk neon",0,1.7,-13.86,4.7,.12,.08,"#61e4d2",undefined,true);
  const sign=label("CHAOS & CANDY",9,2,"#e6b5ff");sign.mesh.position.set(0,3.3,-17.2);sign.mesh.rotation.y=Math.PI;
  for(const x of [-7,7]){box("speaker",x,1.3,-15,1.5,2.5,1.3,"#0e0b19");box("speaker strip",x,1.4,-14.3,.15,1.7,.1,"#e779bd",undefined,true);}
  for(let x=-4;x<=4;x+=2)for(let z=-12;z<=-6;z+=2)box("dance tile",x,.25,z,1.9,.12,1.9,(x+z)%4===0?"#653b83":"#33465a",undefined,true);
  for(const x of [-9,9]){
    box("sofa base",x,.65,-9,2.8,.7,4,"#70375f");box("sofa back",x+(x<0?-.9:.9),1.3,-9,.7,1.2,4,"#a6588d");
    box("table",x,.7,-4.8,2,.2,1.6,"#43a89d");box("table leg",x,.3,-4.8,.3,.7,.3,"#333044");
  }
  for(const z of [-48,48])box("neighborhood road",0,.02,z,180,.1,6,"#322642");
  const plots=new Map<number,{mesh:Mesh;label:ReturnType<typeof label>}>();
  for(let id=1;id<=8;id++){
    const {x,z}=plotPosition(id);
    const mesh=box("plot",x,.04,z,32,.2,32,"#233b3d");mesh.isPickable=true;mesh.metadata={plot:id};
    for(const dx of [-16,16])box("border",x+dx,.19,z,.08,.08,32,"#67e5d1",undefined,true);
    for(const dz of [-16,16])box("border",x,.19,z+dz,32,.08,.08,"#67e5d1",undefined,true);
    const title=label("Plot "+id+" · available",7,1.2,"#8ae4d5");title.mesh.position.set(x,1,z+(z>0?-17:17));title.mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;
    plots.set(id,{mesh,label:title});
  }
  const avatarMap=new Map<string,{root:TransformNode;body:Mesh;name:ReturnType<typeof label>;target:Player}>();
  function playerMesh(player:Player){
    const root=new TransformNode(player.id,scene);
    const body=box("body",0,1.1,0,.7,.9,.42,player.color,root);
    const head=MeshBuilder.CreateSphere("head",{diameter:.52,segments:10},scene);head.parent=root;head.position.y=1.88;head.material=material("#e4b99b");head.isPickable=false;
    box("hair",0,2.08,-.04,.55,.2,.5,"#211831",root);
    box("leg",- .2,.35,0,.24,.7,.3,"#322642",root);box("leg",.2,.35,0,.24,.7,.3,"#322642",root);
    box("arm",-.48,1.1,0,.2,.85,.25,player.color,root);box("arm",.48,1.1,0,.2,.85,.25,player.color,root);
    const name=label(player.name,3,.65);name.mesh.position.y=2.65;name.mesh.parent=root;name.mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;
    root.position.set(player.x,0,player.z);return {root,body,name,target:player};
  }
  const objects=new Map<string,TransformNode>();
  function build(item:Item){
    const root=new TransformNode(item.id,scene),p=plotPosition(item.plot);
    root.position.set(p.x+item.x+.5,.2,p.z+item.z+.5);root.rotation.y=item.rotation*Math.PI/180;
    const part=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,g=false)=>box("part",x,y,z,w,h,d,c,root,g);
    if(item.kind==="wall")part(0,1.3,0,.95,2.6,.22,"#79618c");
    if(item.kind==="floor")part(0,.05,0,.95,.1,.95,"#b68ad7");
    if(item.kind==="chair"){part(0,.5,0,.7,.2,.7,"#db6eae");part(0,.9,.28,.7,.8,.15,"#9e4c90");part(0,.22,0,.25,.45,.25,"#322642");}
    if(item.kind==="table"){part(0,.9,0,.95,.15,.95,"#56b8ae");part(0,.45,0,.2,.9,.2,"#322642");}
    if(item.kind==="lamp"){part(0,1,0,.15,2,.15,"#544068");part(0,2,0,.5,.4,.5,"#78f4df",true);}
    if(item.kind==="tree"){part(0,.8,0,.25,1.6,.25,"#665043");const crown=MeshBuilder.CreateSphere("crown",{diameter:1,segments:6},scene);crown.parent=root;crown.position.y=1.7;crown.material=material("#5dbeaa");}
    if(item.kind==="booth"){part(0,.6,0,.95,1.2,.8,"#7d528d");part(0,2,0,.95,.2,.95,"#d86fae");part(-.4,1.3,.3,.12,1.4,.12,"#50355d");part(.4,1.3,.3,.12,1.4,.12,"#50355d");}
    for(const mesh of root.getChildMeshes()){mesh.isPickable=true;mesh.metadata={plot:item.plot,item:item.id};}
    return root;
  }
  const grid=new TransformNode("build grid",scene);
  for(let n=-16;n<=16;n++){box("grid",n,.17,0,.025,.025,32,"#47706e",grid);box("grid",0,.17,n,32,.025,.025,"#47706e",grid);}
  grid.setEnabled(false);
  const highlight=box("selection",0,.25,0,1,.08,1,"#fbe49b",undefined,true);highlight.setEnabled(false);
  let self="", follow=true, buildMode=false;
  const pick=(event:PointerEvent)=>{
    if(!buildMode)return;
    const rect=canvas.getBoundingClientRect();
    const result=scene.pick(event.clientX-rect.left,event.clientY-rect.top);
    const meta=result?.pickedMesh?.metadata;
    if(!result?.pickedPoint||!meta?.plot)return;
    const p=plotPosition(meta.plot),x=Math.floor(result.pickedPoint.x-p.x),z=Math.floor(result.pickedPoint.z-p.z);
    if(x< -16||x>15||z< -16||z>15)return;
    highlight.position.set(p.x+x+.5,.3,p.z+z+.5);highlight.setEnabled(true);onPick(meta.plot,x,z,meta.item);
  };
  // A short click selects a building cell; dragging rotates the view.
  let down={x:0,y:0};
  const pointerDown=(event:PointerEvent)=>{down={x:event.clientX,y:event.clientY};};
  const pointerUp=(event:PointerEvent)=>{if(Math.hypot(event.clientX-down.x,event.clientY-down.y)<8)pick(event);};
  canvas.addEventListener("pointerdown",pointerDown);canvas.addEventListener("pointerup",pointerUp);
  let disposed=false;
  const render=()=>{
    const now=performance.now()/1000;
    for(const avatar of avatarMap.values()){
      const p=avatar.target;
      avatar.root.position.x+=(p.x-avatar.root.position.x)*.3;avatar.root.position.z+=(p.z-avatar.root.position.z)*.3;
      avatar.root.rotation.y=p.rotation+(p.emote==="dance"?Math.sin(now*3)*.45:0);
      avatar.root.position.y=p.emote==="dance"?Math.abs(Math.sin(now*5))*.18:p.emote==="sit"?-.45:0;
      avatar.root.rotation.z=p.emote==="wave"?Math.sin(now*5)*.12:0;
      if(p.id===self&&follow)camera.target=Vector3.Lerp(camera.target,new Vector3(avatar.root.position.x,1,avatar.root.position.z),.12);
    }
    scene.render();
  };
  engine.runRenderLoop(render);
  const resize=()=>engine.resize();window.addEventListener("resize",resize);
  return {
    players(list:Player[],id:string){self=id;const ids=new Set(list.map(p=>p.id));for(const [id,a] of avatarMap)if(!ids.has(id)){a.name.dispose();a.root.dispose();avatarMap.delete(id);}
      for(const p of list){let a=avatarMap.get(p.id);if(!a){a=playerMesh(p);avatarMap.set(p.id,a);}a.target=p;a.body.material=material(p.color);}},
    world(list:Plot[],items:Item[]){
      for(const plot of list){const entry=plots.get(plot.id)!;entry.label.dispose();entry.label=label(plot.owner?plot.name:"Plot "+plot.id+" · available",7,1.2,plot.owner?"#e6b5ff":"#8ae4d5");const p=plotPosition(plot.id);entry.label.mesh.position.set(p.x,1,p.z+(p.z>0?-17:17));entry.label.mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;}
      const ids=new Set(items.map(i=>i.id));for(const [id,node] of objects)if(!ids.has(id)){node.dispose();objects.delete(id);}
      for(const item of items)if(!objects.has(item.id))objects.set(item.id,build(item));
    },
    select(plot:number,x:number,z:number){const p=plotPosition(plot);highlight.position.set(p.x+x+.5,.3,p.z+z+.5);highlight.setEnabled(true);},
    mode(enabled:boolean){buildMode=enabled;grid.setEnabled(enabled);if(!enabled)highlight.setEnabled(false);},
    plot(id:number){follow=false;const p=plotPosition(id);grid.position.set(p.x,0,p.z);camera.target.set(p.x,0,p.z);camera.radius=52;camera.beta=.45;},
    follow(){follow=true;camera.radius=21;camera.beta=1.04;},
    direction(x:number,z:number){const forward=new Vector3(camera.target.x-camera.position.x,0,camera.target.z-camera.position.z).normalize();return {x:forward.x*z+forward.z*x,z:forward.z*z-forward.x*x};},
    dispose(){if(disposed)return;disposed=true;window.removeEventListener("resize",resize);canvas.removeEventListener("pointerdown",pointerDown);canvas.removeEventListener("pointerup",pointerUp);scene.dispose();engine.dispose();}
  };
}
export type WorldScene=Awaited<ReturnType<typeof createWorld>>;
