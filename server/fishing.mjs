import {randomInt,randomUUID} from 'node:crypto';
// Time and random source are injectable only for isolated server tests.
export function fishing(db,{now=Date.now,roll=()=>randomInt(100)}={}){
  const run=(tx,sql,args=[])=>tx.execute({sql,args});
  async function transaction(fn){const tx=await db.transaction('write');try{const result=await fn(tx);await tx.commit();return result;}catch(error){await tx.rollback();throw error;}finally{tx.close();}}
  function near(p,x,z){return Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x-x,p.z-z)<=6;}
  async function state(id){const inv=(await run(db,'SELECT * FROM world_inventory WHERE user_id=?',[id])).rows[0];const cast=(await run(db,'SELECT * FROM world_fishing WHERE user_id=?',[id])).rows[0];return {fish:Number(inv?.fish||0),dance:!!inv?.dance,ready:cast&&!cast.claimed?Number(cast.ready):0,expires:cast&&!cast.claimed?Number(cast.expires):0,nextCast:Number(cast?.next_cast||0),serverNow:now()};}
  async function cast(id,p){if(!near(p,30,26))throw new Error('Go to the fishing pier before casting.');return transaction(async tx=>{
    const t=now(),old=(await run(tx,'SELECT * FROM world_fishing WHERE user_id=?',[id])).rows[0];
    if(old&&Number(old.next_cast)>t)throw new Error('Wait before casting again.');
    if(old&&!old.claimed&&Number(old.expires)>t)throw new Error('Reel in your current catch first.');
    await run(tx,'INSERT INTO world_fishing(user_id,cast_id,ready,expires,next_cast,claimed) VALUES (?,?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET cast_id=excluded.cast_id,ready=excluded.ready,expires=excluded.expires,next_cast=excluded.next_cast,claimed=0',[id,randomUUID(),t+12000,t+42000,t+20000]);
    return 'Line cast! Wait 12 seconds, then reel in before the fish escapes.';
  });}
  async function reel(id,p){if(!near(p,30,26))throw new Error('Return to the fishing pier to reel in.');return transaction(async tx=>{
    const t=now(),cast=(await run(tx,'SELECT * FROM world_fishing WHERE user_id=?',[id])).rows[0];
    if(!cast||cast.claimed)throw new Error('Cast your line first.');
    if(t<Number(cast.ready))throw new Error('No bite yet. Wait a little longer.');
    if(t>Number(cast.expires))throw new Error('The fish escaped. Cast again.');
    await run(tx,'UPDATE world_fishing SET claimed=1 WHERE user_id=?',[id]);
    await run(tx,'INSERT INTO world_inventory(user_id) VALUES (?) ON CONFLICT DO NOTHING',[id]);
    const inv=(await run(tx,'SELECT dance FROM world_inventory WHERE user_id=?',[id])).rows[0];
    if(roll()<3&&!inv.dance){await run(tx,'UPDATE world_inventory SET dance=1 WHERE user_id=?',[id]);return 'Rare catch! Neon Spin dance unlocked permanently.';}
    await run(tx,'UPDATE world_inventory SET fish=fish+1 WHERE user_id=?',[id]);
    return 'Caught a fish! Marina will buy it for 10 CB.';
  });}
  async function sell(id,p){if(!near(p,30,20))throw new Error('Visit Marina beside the pier to sell fish.');return transaction(async tx=>{
    const count=Number((await run(tx,'SELECT fish FROM world_inventory WHERE user_id=?',[id])).rows[0]?.fish||0);
    if(!count)throw new Error('Your fishing bag is empty.');
    const credit=await run(tx,'UPDATE world_wallets SET balance=balance+? WHERE user_id=?',[count*10,id]);
    if(!credit.rowsAffected)throw new Error('Reconnect to load your wallet.');
    await run(tx,'UPDATE world_inventory SET fish=0 WHERE user_id=?',[id]);
    await run(tx,'INSERT INTO world_ledger(event,user_id,amount,reason) VALUES (?,?,?,?)',['fish-sale:'+randomUUID(),id,count*10,'Sold '+count+' fish to Marina']);
    return 'Sold '+count+' fish to Marina for '+count*10+' CB.';
  });}
  return {state,cast,reel,sell};
}
