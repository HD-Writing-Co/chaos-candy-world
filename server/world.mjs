export const COLORS=['#cf7aff','#ff75b9','#5ce4d0','#f9c46a','#7ba7ff'];
export const ITEMS=['wall','floor','chair','table','lamp','tree','booth'];
export const PLOTS=Array.from({length:8},(_,i)=>({id:i+1,x:(i%4)*14-21,z:i<4?22:-24}));
export const SPAWN={x:0,z:4};
export function placement(value){
  return value&&Number.isInteger(value.plot)&&value.plot>=1&&value.plot<=8&&
    ITEMS.includes(value.kind)&&Number.isInteger(value.x)&&value.x>=-4&&value.x<=4&&
    Number.isInteger(value.z)&&value.z>=-4&&value.z<=4&&
    [0,90,180,270].includes(value.rotation);
}
export function move(player,input,dt){
  const dx=Number(input.x),dz=Number(input.z);
  if(!Number.isFinite(dx)||!Number.isFinite(dz))return;
  const magnitude=Math.hypot(dx,dz);
  const scale=magnitude>1?1/magnitude:1;
  player.x=Math.max(-30,Math.min(30,player.x+dx*scale*dt*4.5));
  player.z=Math.max(-31,Math.min(29,player.z+dz*scale*dt*4.5));
  if(magnitude>.01){player.rotation=Math.atan2(dx,dz);player.emote='';}
}
