import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {Scene} from '@babylonjs/core/scene.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {clubGain} from '../app/music.ts';
import {PLOTS,placement} from '../server/world.mjs';

test('ray module enables real plot hit detection',()=>{
 const source=readFileSync(new URL('../app/scene.ts',import.meta.url),'utf8');
 assert.match(source,/import "@babylonjs\/core\/Culling\/ray"/);
 const engine=new NullEngine();const scene=new Scene(engine);
 const plot=MeshBuilder.CreateBox('plot',{width:32,height:.2,depth:32},scene);plot.material=new StandardMaterial('surface',scene);plot.computeWorldMatrix(true);
 const hit=scene.pickWithRay(new Ray(new Vector3(15.5,10,-15.5),new Vector3(0,-1,0)));
 assert.equal(hit.hit,true);assert.equal(hit.pickedMesh,plot);
 assert.equal(Math.floor(hit.pickedPoint.x),15);assert.equal(Math.floor(hit.pickedPoint.z),-16);
 scene.dispose();engine.dispose();
});
test('music fades with avatar distance and is silent everywhere on plots',()=>{
 assert.equal(clubGain(0,-10),1);assert.equal(clubGain(0,18),0);
 assert.ok(clubGain(0,9)>clubGain(0,14));
 for(const p of PLOTS)for(const x of [-16,0,16])for(const z of [-16,0,16])assert.equal(clubGain(p.x+x,p.z+z),0);
});
test('32 by 32 integer grid fits all plot edges and retains old coordinates',()=>{
 let count=0;for(let x=-16;x<=15;x++)for(let z=-16;z<=15;z++){assert.ok(placement({plot:1,kind:'wall',x,z,rotation:0}));count++;}
 assert.equal(count,1024);
 assert.ok(placement({plot:1,kind:'chair',x:4,z:-4,rotation:90}));
 assert.equal(placement({plot:1,kind:'wall',x:16,z:0,rotation:0}),false);
});
