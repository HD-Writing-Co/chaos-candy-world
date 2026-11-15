export const PRICE=1000;
export function economy(db){
  const day=()=>new Date().toISOString().slice(0,10);
  async function transaction(fn){const tx=await db.transaction('write');try{const value=await fn(tx);await tx.commit();return value;}catch(e){await tx.rollback();throw e;}finally{tx.close();}}
  const run=(tx,sql,args=[])=>tx.execute({sql,args});
  async function init(id){await transaction(async tx=>{const added=await run(tx,'INSERT INTO world_wallets(user_id,balance) VALUES (?,500) ON CONFLICT DO NOTHING',[id]);if(added.rowsAffected)await run(tx,'INSERT INTO world_ledger(event,user_id,amount,reason) VALUES (?,?,500,?)',['welcome:'+id,id,'Welcome bonus']);});}
  async function state(id){const wallet=(await run(db,'SELECT balance FROM world_wallets WHERE user_id=?',[id])).rows[0];const daily=(await run(db,'SELECT event FROM world_ledger WHERE event=?',['daily:'+id+':'+day()])).rows.length>0;return {balance:Number(wallet?.balance||0),daily,day:day(),price:PRICE};}
  async function daily(id){await transaction(async tx=>{const result=await run(tx,'INSERT INTO world_ledger(event,user_id,amount,reason) VALUES (?,?,50,?) ON CONFLICT DO NOTHING',['daily:'+id+':'+day(),id,'Daily check-in']);if(result.rowsAffected)await run(tx,'UPDATE world_wallets SET balance=balance+50 WHERE user_id=?',[id]);});return state(id);}
  async function buy(id,name,plot){await transaction(async tx=>{
    const claimed=await run(tx,"UPDATE world_plots SET owner=?,name=? WHERE id=? AND owner IS NULL AND NOT EXISTS (SELECT 1 FROM world_plots WHERE owner=?)",[id,name+"'s plot",plot,id]);
    if(!claimed.rowsAffected)throw new Error('That plot is sold, or you already own a plot.');
    const paid=await run(tx,'UPDATE world_wallets SET balance=balance-? WHERE user_id=? AND balance>=?',[PRICE,id,PRICE]);
    if(!paid.rowsAffected)throw new Error('You need 1,000 CB to buy a plot. Open Chaos Bucks to earn more.');
    await run(tx,'INSERT INTO world_ledger(event,user_id,amount,reason) VALUES (?,?,?,?)',['plot:'+plot,id,-PRICE,'Plot '+plot]);
  });return state(id);}
  return {init,state,daily,buy};
}
