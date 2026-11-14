import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {start} from './index.mjs';
import {move,placement} from './world.mjs';

test('movement is bounded and diagonal speed is normalized; placement is restricted',()=>{
  const p={x:0,z:0};move(p,{x:100,z:100},1);assert.ok(Math.abs(Math.hypot(p.x,p.z)-4.5)<.001);
  move(p,{x:NaN,z:0},1);assert.ok(Number.isFinite(p.x));
  assert.equal(placement({plot:1,kind:'chair',x:0,z:0,rotation:90}),true);
  for(const bad of [{plot:9},{x:5},{kind:'script'},{rotation:23}])assert.equal(placement({plot:1,kind:'chair',x:0,z:0,rotation:90,...bad}),false);
});

test('authenticated multiplayer, atomic ownership, persistence and moderation',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'candy-world-'));
  const config={PORT:'18349',APP_URL:'http://localhost:3000',API_PROXY_SECRET:randomBytes(32).toString('hex'),TURSO_DATABASE_URL:'file:'+join(dir,'test.sqlite'),DISCORD_OWNER_ID:'owner'};
  let app=await start(config);const base='http://127.0.0.1:18349';const clients=[];
  const query=(sql,args=[])=>app.db.execute({sql,args});
  async function user(id){
    const raw=randomBytes(32).toString('base64url');
    await query('INSERT INTO world_users(id,name,avatar) VALUES (?,?,?)',[id,id,'']);
    await query('INSERT INTO world_sessions VALUES (?,?,?)',[createHash('sha256').update(raw).digest('hex'),id,Date.now()+60000]);
    return {'x-world-proxy':config.API_PROXY_SECRET,cookie:'cc_world='+raw};
  }
  async function connect(headers){
    const response=await fetch(base+'/api/ticket',{method:'POST',headers});assert.equal(response.status,200);
    const {ticket}=await response.json();
    const ws=new WebSocket('ws://127.0.0.1:18349/live',{origin:config.APP_URL});clients.push(ws);
    const queue=[];ws.on('message',data=>queue.push(JSON.parse(data)));
    ws.on('open',()=>ws.send(JSON.stringify({type:'auth',ticket})));
    const wait=async(type)=>{for(let i=0;i<200;i++){const n=queue.findIndex(m=>m.type===type);if(n>=0)return queue.splice(n,1)[0];await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out: '+type);};
    await wait('welcome');return {ws,wait,send:m=>ws.send(JSON.stringify(m)),queue};
  }
  try{
    assert.equal((await fetch(base+'/api/me')).status,403);
    assert.equal((await fetch(base+'/api/ticket',{method:'POST',headers:{'x-world-proxy':config.API_PROXY_SECRET}})).status,401);
    const bad=await fetch(base+'/api/auth/callback?code=bad&state=wrong',{headers:{'x-world-proxy':config.API_PROXY_SECRET},redirect:'manual'});assert.ok(bad.headers.get('location').endsWith('?error=login'));
    const ha=await user('owner'),hb=await user('member');const a=await connect(ha),b=await connect(hb);
    a.send({type:'claim',plot:1});b.send({type:'claim',plot:1});
    for(let i=0;i<100;i++){if((await query('SELECT owner FROM world_plots WHERE id=1')).rows[0].owner)break;await new Promise(r=>setTimeout(r,10));}
    await new Promise(r=>setTimeout(r,100));
    const id=(await query('SELECT owner FROM world_plots WHERE id=1')).rows[0].owner;
    const winner=id==='owner'?a:b,loser=id==='owner'?b:a;
    assert.equal((await query('SELECT COUNT(*) AS n FROM world_plots WHERE owner IS NOT NULL')).rows[0].n,1);
    loser.queue.length=0;loser.send({type:'place',plot:1,kind:'chair',x:0,z:0,rotation:0});await loser.wait('error');
    assert.equal((await query('SELECT COUNT(*) AS n FROM world_objects')).rows[0].n,0);
    winner.queue.length=0;winner.send({type:'place',plot:1,kind:'chair',x:0,z:0,rotation:0});await winner.wait('saved');
    assert.equal((await query('SELECT COUNT(*) AS n FROM world_objects')).rows[0].n,1);
    winner.send({type:'claim',plot:2});await winner.wait('error');
    winner.send({type:'place',plot:1,kind:'tree',x:8,z:0,rotation:0});await winner.wait('error');
    loser.send({type:'remove',id:(await query('SELECT id FROM world_objects')).rows[0].id});await loser.wait('error');
    b.send({type:'ban',user:'owner'});await b.wait('error');
    a.send({type:'chat',body:'hello <script> literal text'});assert.equal((await b.wait('chat')).message.body,'hello <script> literal text');
    // The normal ten-inputs-per-second client must not trip the old 180/minute limit.
    for(let i=0;i<200;i++)a.send({type:'move',x:1,z:0});await new Promise(r=>setTimeout(r,100));assert.equal(a.ws.readyState,WebSocket.OPEN);
    a.send({type:'ban',user:'member'});await new Promise(r=>b.ws.once('close',r));
    assert.equal((await fetch(base+'/api/ticket',{method:'POST',headers:hb})).status,401);
    await app.close();app=await start(config);
    assert.equal((await query('SELECT COUNT(*) AS n FROM world_objects')).rows[0].n,1);
    assert.equal((await query('SELECT owner FROM world_plots WHERE id=1')).rows[0].owner,id);
  }finally{for(const ws of clients)ws.terminate();await app.close();await rm(dir,{recursive:true,force:true});}
});
