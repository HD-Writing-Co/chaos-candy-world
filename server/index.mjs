import express from 'express';
import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {createClient} from '@libsql/client';
import {createHash,randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {COLORS,PLOTS,SPAWN,placement,move} from './world.mjs';

export async function start(config=process.env){
  const origin=new URL(config.APP_URL||'http://localhost:3000').origin;
  const secret=config.API_PROXY_SECRET;
  if(!secret||secret.length<32)throw new Error('API_PROXY_SECRET must have at least 32 characters.');
  if(!config.TURSO_DATABASE_URL)throw new Error('TURSO_DATABASE_URL is required.');
  const db=createClient({url:config.TURSO_DATABASE_URL,authToken:config.TURSO_AUTH_TOKEN});
  await db.executeMultiple(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  await db.batch(PLOTS.map(p=>({sql:'INSERT INTO world_plots(id) VALUES (?) ON CONFLICT DO NOTHING',args:[p.id]})),'write');
  const sql=(query,args=[])=>db.execute({sql:query,args});
  const digest=value=>createHash('sha256').update(value).digest('hex');
  const token=()=>randomBytes(32).toString('base64url');
  const same=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
  const cookieName='cc_world';
  const secure=origin.startsWith('https:')?'; Secure':'';
  const cookie=(name,value,age)=>name+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+secure;
  const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=')));
  const tickets=new Map(), players=new Map(), recent=[], throttles=new Map();
  const app=express(), server=createServer(app), wss=new WebSocketServer({noServer:true,maxPayload:4096});
  const ownerId=config.DISCORD_OWNER_ID||'';
  let world={plots:[],objects:[]};
  async function readWorld(){
    const [plots,objects]=await Promise.all([sql('SELECT p.*,u.name AS owner_name FROM world_plots p LEFT JOIN world_users u ON u.id=p.owner ORDER BY p.id'),sql('SELECT * FROM world_objects')]);
    world={plots:plots.rows,objects:objects.rows};
    broadcast({type:'world',...world});
  }
  function send(ws,data){if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<128000)ws.send(JSON.stringify(data));}
  function broadcast(data){for(const ws of wss.clients)if(ws.user)send(ws,data);}
  function limited(key,limit=15){
    const now=Date.now(),old=throttles.get(key);
    const item=old&&old.until>now?old:{until:now+60000,count:0};
    item.count++;throttles.set(key,item);return item.count>limit;
  }
  async function session(req){
    const raw=cookies(req)[cookieName];
    if(!raw||!/^[\w-]{43}$/.test(raw))return null;
    const result=await sql('SELECT u.*,s.expires AS session_expires FROM world_sessions s JOIN world_users u ON u.id=s.user_id WHERE s.digest=? AND s.expires>? AND u.banned=0',[digest(raw),Date.now()]);
    return result.rows[0]||null;
  }
  app.get('/health',(_,res)=>res.json({ok:true,players:players.size}));
  app.use('/api',(req,res,next)=>{
    if(!same(req.headers['x-world-proxy'],secret))return res.status(403).json({error:'Access denied.'});
    res.set('Cache-Control','no-store');
    next();
  });
  app.use(express.json({limit:'4kb'}));
  app.get('/api/auth/login',(req,res)=>{
    if(!config.DISCORD_CLIENT_ID||!config.DISCORD_CLIENT_SECRET||!config.DISCORD_GUILD_ID)return res.redirect(origin+'/?error=setup');
    const state=token();
    res.set('Set-Cookie',cookie('cc_oauth',state,600));
    const url=new URL('https://discord.com/oauth2/authorize');
    url.search=new URLSearchParams({client_id:config.DISCORD_CLIENT_ID,redirect_uri:origin+'/api/auth/callback',response_type:'code',scope:'identify guilds.members.read',state}).toString();
    res.redirect(url.href);
  });
  app.get('/api/auth/callback',async(req,res)=>{
    const state=cookies(req).cc_oauth;
    res.set('Set-Cookie',cookie('cc_oauth','',0));
    if(typeof req.query.code!=='string'||typeof req.query.state!=='string'||!state||!same(req.query.state,state))return res.redirect(origin+'/?error=login');
    try{
      const response=await fetch('https://discord.com/api/oauth2/token',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.DISCORD_CLIENT_ID,client_secret:config.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code:req.query.code,redirect_uri:origin+'/api/auth/callback'})});
      if(!response.ok)throw new Error('Discord token exchange failed');
      const grant=await response.json();
      const headers={Authorization:'Bearer '+grant.access_token};
      const [identity,membership]=await Promise.all([
        fetch('https://discord.com/api/users/@me',{headers,signal:AbortSignal.timeout(10000)}),
        fetch('https://discord.com/api/users/@me/guilds/'+config.DISCORD_GUILD_ID+'/member',{headers,signal:AbortSignal.timeout(10000)})
      ]);
      if(!membership.ok)return res.redirect(origin+'/?error=membership');
      if(!identity.ok)throw new Error('Identity lookup failed');
      const user=await identity.json(), member=await membership.json();
      const name=(member.nick||user.global_name||user.username).slice(0,40);
      const avatar=user.avatar?'https://cdn.discordapp.com/avatars/'+user.id+'/'+user.avatar+'.png?size=64':'';
      await sql("INSERT INTO world_users(id,name,avatar) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,avatar=excluded.avatar",[user.id,name,avatar]);
      const saved=(await sql('SELECT banned FROM world_users WHERE id=?',[user.id])).rows[0];
      if(saved.banned)return res.redirect(origin+'/?error=banned');
      const raw=token();
      await sql('INSERT INTO world_sessions VALUES (?,?,?)',[digest(raw),user.id,Date.now()+86400000]);
      res.append('Set-Cookie',cookie(cookieName,raw,86400));
      res.redirect(origin+'/');
    }catch{res.redirect(origin+'/?error=login');}
  });
  app.get('/api/me',async(req,res)=>{
    const user=await session(req);
    res.json({user:user?{...user,admin:user.id===ownerId}:null});
  });
  app.post('/api/logout',async(req,res)=>{
    const raw=cookies(req)[cookieName];
    if(raw){
      const user=await session(req);
      await sql('DELETE FROM world_sessions WHERE digest=?',[digest(raw)]);
      if(user)for(const ws of wss.clients)if(ws.user?.id===user.id)ws.close(4001,'Signed out');
    }
    res.set('Set-Cookie',cookie(cookieName,'',0)).json({ok:true});
  });
  app.use('/api',async(req,res,next)=>{
    req.user=await session(req);
    if(!req.user)return res.status(401).json({error:'Sign in with Discord to continue.'});
    if(limited('api:'+req.user.id,90))return res.status(429).json({error:'Slow down and try again.'});
    next();
  });
  app.post('/api/ticket',(req,res)=>{
    const value=token();
    tickets.set(value,{user:req.user,expires:Date.now()+15000});
    res.json({ticket:value});
  });
  app.use((error,req,res,next)=>{res.status(error.status||500).json({error:'The server could not complete the request. Try again.'});});
  server.on('upgrade',(req,socket,head)=>{
    if(req.url!=='/live'||req.headers.origin!==origin||wss.clients.size>=40){socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  let mutation=Promise.resolve();
  function enqueue(task){const next=mutation.then(task);mutation=next.catch(()=>{});return next;}
  wss.on('connection',ws=>{
    ws.alive=true;ws.on('pong',()=>ws.alive=true);
    const deadline=setTimeout(()=>{if(!ws.user)ws.close(4001,'Authentication required');},5000);
    ws.on('close',()=>{clearTimeout(deadline);if(ws.user&&players.get(ws.user.id)?.ws===ws){players.delete(ws.user.id);broadcast({type:'players',players:snapshot()});}});
    ws.on('message',async raw=>{
      try{
        if(limited('socket:'+ (ws.user?.id||ws._socket.remoteAddress),1200))return ws.close(4008,'Rate limit');
        const msg=JSON.parse(raw.toString());
        if(!ws.user){
          if(ws.authenticating)return;
          ws.authenticating=true;
          const ticket=tickets.get(msg.ticket);
          tickets.delete(msg.ticket);
          if(msg.type!=='auth'||!ticket||ticket.expires<Date.now())return ws.close(4001,'Ticket expired');
          clearTimeout(deadline);
          const user=ticket.user;
          if(user.session_expires<=Date.now())return ws.close(4001,'Sign in again');
          const banned=(await sql('SELECT banned FROM world_users WHERE id=?',[user.id])).rows[0]?.banned;
          if(banned)return ws.close(4003,'Access denied');
          if(!players.has(user.id)&&players.size>=24)return ws.close(4004,'The world is full. Try again shortly.');
          if(ws.readyState!==WebSocket.OPEN)return;
          const prior=players.get(user.id);
          if(prior)prior.ws.close(4002,'Opened in another tab');
          ws.user=user;
          players.set(user.id,{ws,id:user.id,name:user.name,color:user.color,...SPAWN,rotation:0,emote:'',input:{x:0,z:0},lastInput:0,seen:Date.now()});
          send(ws,{type:'welcome',me:{...user,admin:user.id===ownerId},...world,messages:recent});
          return;
        }
        const player=players.get(ws.user.id);
        if(!player||player.ws!==ws)return;
        if(msg.type==='move'){player.input={x:msg.x,z:msg.z};player.lastInput=Date.now();return;}
        if(msg.type==='emote'&&['','dance','wave','sit'].includes(msg.emote)){player.emote=msg.emote;return;}
        if(msg.type==='home'){Object.assign(player,SPAWN);player.input={x:0,z:0};return;}
        if(msg.type==='chat'){
          if(limited('chat:'+player.id,20))throw new Error('Please slow down.');
          const body=typeof msg.body==='string'?msg.body.trim().slice(0,300):'';
          if(!body)return;
          const message={id:randomUUID(),user:player.id,name:player.name,body,created:Date.now()};
          recent.push(message);if(recent.length>60)recent.shift();
          broadcast({type:'chat',message});return;
        }
        if(limited('build:'+player.id,100))throw new Error('Please slow down.');
        await enqueue(async()=>{
          if(players.get(player.id)?.ws!==ws)return;
          if(msg.type==='color'&&COLORS.includes(msg.color)){
            await sql('UPDATE world_users SET color=? WHERE id=?',[msg.color,player.id]);player.color=msg.color;return;
          }
          if(msg.type==='claim'){
            if(!Number.isInteger(msg.plot)||!PLOTS.some(p=>p.id===msg.plot))throw new Error('Select a plot.');
            const result=await sql("UPDATE world_plots SET owner=?,name=? WHERE id=? AND owner IS NULL AND NOT EXISTS (SELECT 1 FROM world_plots WHERE owner=?)",[player.id,player.name+"'s plot",msg.plot,player.id]);
            if(!result.rowsAffected)throw new Error('That plot is claimed, or you already own a plot.');
          }else if(msg.type==='place'){
            if(!placement(msg))throw new Error('Choose an item and a valid grid square.');
            const result=await sql("INSERT INTO world_objects SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM world_plots WHERE id=? AND owner=?) AND (SELECT COUNT(*) FROM world_objects WHERE plot=?)<60 ON CONFLICT(plot,x,z) DO NOTHING",[randomUUID(),msg.plot,msg.kind,msg.x,msg.z,msg.rotation,msg.plot,player.id,msg.plot]);
            if(!result.rowsAffected)throw new Error('Build on your own plot in an empty square. Limit 60 items.');
          }else if(msg.type==='remove'){
            if(typeof msg.id!=='string')return;
            const result=await sql("DELETE FROM world_objects WHERE id=? AND EXISTS (SELECT 1 FROM world_plots WHERE id=world_objects.plot AND owner=?)",[msg.id,player.id]);
            if(!result.rowsAffected)throw new Error('You can remove objects on your own plot.');
          }else if(msg.type==='rename'){
            const name=typeof msg.name==='string'?msg.name.trim().slice(0,40):'';
            if(!name)throw new Error('Enter a plot name.');
            await sql('UPDATE world_plots SET name=? WHERE owner=?',[name,player.id]);
          }else if(msg.type==='ban'){
            if(player.id!==ownerId||typeof msg.user!=='string'||msg.user===ownerId)throw new Error('Only the owner can moderate members.');
            await sql('UPDATE world_users SET banned=1 WHERE id=?',[msg.user]);
            await sql('DELETE FROM world_sessions WHERE user_id=?',[msg.user]);
            players.get(msg.user)?.ws.close(4003,'Removed by the owner');
          }else return;
          await readWorld();send(ws,{type:'saved'});
        });
      }catch(error){send(ws,{type:'error',message:error?.message?.includes('SQL')?'Couldn’t save. Try again.':error?.message||'Request failed.'});}
    });
  });
  const snapshot=()=>[...players.values()].map(({ws,input,lastInput,seen,...p})=>p);
  const tick=setInterval(()=>{
    const now=Date.now();
    for(const player of players.values())if(now-player.lastInput<500)move(player,player.input,.1);
    broadcast({type:'players',players:snapshot()});
  },100);
  const cleanup=setInterval(()=>{
    for(const [key,value] of tickets)if(value.expires<Date.now())tickets.delete(key);
    for(const [key,value] of throttles)if(value.until<Date.now())throttles.delete(key);
    for(const ws of wss.clients){if(ws.user?.session_expires<=Date.now()){ws.close(4001,'Session expired. Sign in again.');continue;}if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
    void sql('DELETE FROM world_sessions WHERE expires<=?',[Date.now()]).catch(()=>{});
  },30000);
  await readWorld();
  await new Promise(resolve=>server.listen(Number(config.PORT)||8080,'0.0.0.0',resolve));
  console.log('World server ready.');
  return {server,db,close:async()=>{clearInterval(tick);clearInterval(cleanup);for(const ws of wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));db.close();}};
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
  start().catch(error=>{console.error(error.message);process.exit(1);});
}
