// Original synthesized demo loop. No external music files or streaming service.
export function clubGain(x:number,z:number){
  const distance=Math.hypot(x,z+10);
  if(distance>=28)return 0;
  if(distance<=10)return 1;
  const t=(28-distance)/18;return t*t*(3-2*t);
}
export function createClubMusic(){
  const url=process.env.NEXT_PUBLIC_CLUB_MUSIC_URL?.trim();
  if(url){
    const audio=new Audio(url);audio.loop=true;audio.preload="none";audio.volume=0;
    return {
      async resume(){await audio.play();},
      position(x:number,z:number,volume:number){audio.volume=Math.max(0,Math.min(1,clubGain(x,z)*volume));},
      stop(){audio.pause();audio.removeAttribute("src");audio.load();}
    };
  }
  const context=new AudioContext(),master=context.createGain();
  master.gain.value=0;master.connect(context.destination);
  const beat=60/112;let step=0,next=context.currentTime+.05;
  function tone(frequency:number,time:number,duration:number,volume:number,type:OscillatorType='sine'){
    const osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.value=frequency;
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(gain);gain.connect(master);osc.start(time);osc.stop(time+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    return osc;
  }
  function schedule(){
    if(context.state!=='running')return;
    if(next<context.currentTime)next=context.currentTime+.05;
    while(next<context.currentTime+.15){
      const root=[130.81,155.56,103.83,116.54][Math.floor(step/16)%4];
      if(step%4===0){const kick=tone(110,next,.24,.38);kick.frequency.exponentialRampToValueAtTime(42,next+.2);tone(root/2,next,.3,.12,'triangle');}
      if(step%4===2)tone(1700,next,.045,.025,'square');
      if(step%8===4)tone(240,next,.09,.06,'triangle');
      const melody=[1,0,1.5,2,0,1.25,1.5,0][step%8];if(melody)tone(root*melody*2,next,.17,.055,'triangle');
      step++;next+=beat/4;
    }
  }
  const timer=setInterval(schedule,50);
  return {
    async resume(){await context.resume();schedule();},
    position(x:number,z:number,volume:number){master.gain.setTargetAtTime(clubGain(x,z)*volume,context.currentTime,.15);},
    stop(){clearInterval(timer);void context.close();}
  };
}
export type ClubMusic=ReturnType<typeof createClubMusic>;
