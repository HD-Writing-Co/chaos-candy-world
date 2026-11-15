"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {ArrowRight,ChevronDown,Home,MessageCircle,Users,Hammer,Music2,LogOut,Sparkles,X,RotateCw,Move,RefreshCw} from "lucide-react";
import {COLORS,ITEMS,type Player,type Plot,type Item,type Message} from "./types";
import {createClubMusic,type ClubMusic} from "./music";
import type {WorldScene} from "./scene";

type Wallet={balance:number;daily:boolean;day:string;price:number};
type Fishing={fish:number;dance:boolean;ready:number;expires:number;nextCast:number;serverNow:number};
type Frame={fishing:Fishing;result?:string;wallet:Wallet;type:string;me:Player;players:Player[];plots:Plot[];objects:Item[];messages:Message[];message:Message};
export default function World({websocket}:{websocket:string}){
  const [me,setMe]=useState<Player|null>(null),[checked,setChecked]=useState(false),[status,setStatus]=useState("Loading");
  const [players,setPlayers]=useState<Player[]>([]),[plots,setPlots]=useState<Plot[]>([]),[items,setItems]=useState<Item[]>([]),[messages,setMessages]=useState<Message[]>([]);
  const [panel,setPanel]=useState<"chat"|"plots"|"people">("chat"),[expanded,setExpanded]=useState(true),[error,setError]=useState(""),[draft,setDraft]=useState("");
  const [color,setColor]=useState(COLORS[0]),[selectedPlot,setSelectedPlot]=useState(1),[kind,setKind]=useState("chair"),[rotation,setRotation]=useState(0);
  const [cell,setCell]=useState<{plot:number;x:number;z:number;item?:string}|null>(null),[build,setBuild]=useState(false),[plotName,setPlotName]=useState(""),[retry,setRetry]=useState(0),[ready,setReady]=useState(false),[saveStatus,setSaveStatus]=useState("");
  const canvas=useRef<HTMLCanvasElement>(null),scene=useRef<WorldScene|null>(null),socket=useRef<WebSocket|null>(null),keys=useRef(new Set<string>()),stick=useRef({x:0,z:0}),end=useRef<HTMLDivElement>(null);
  const authenticated=useRef(false);
  const [fishing,setFishing]=useState<Fishing|null>(null),[fishOpen,setFishOpen]=useState(false),[catchResult,setCatchResult]=useState(""),[clock,setClock]=useState(0);
  const clockOffset=useRef(0);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()+clockOffset.current),500);return ()=>clearInterval(timer);},[]);
  const [wallet,setWallet]=useState<Wallet|null>(null),[earn,setEarn]=useState(false),[freeCamera,setFreeCamera]=useState(false);
  const music=useRef<ClubMusic|null>(null);
  const [musicOn,setMusicOn]=useState(false),[volume,setVolume]=useState(.35),[gridX,setGridX]=useState(0),[gridZ,setGridZ]=useState(0);
  const playersRef=useRef<Player[]>([]),worldRef=useRef({plots:[] as Plot[],objects:[] as Item[]}),myId=useRef("");
  const connected=status==="Connected", mine=plots.find(p=>p.owner===me?.id), plot=plots.find(p=>p.id===selectedPlot);
  const send=(value:object)=>{if(socket.current?.readyState===WebSocket.OPEN&&connected){socket.current.send(JSON.stringify(value));return true;}setError("Reconnect before making changes.");return false;};
  useEffect(()=>{
    let active=true;
    const errors:Record<string,string>={membership:"Join the Discord server before entering this world.",setup:"Discord login needs configuration. Follow START-HERE.md.",login:"Discord sign-in did not finish. Please try again.",banned:"Your access to this world has been removed."};
    const code=new URLSearchParams(location.search).get("error");if(code)setError(errors[code]??"Sign-in failed.");
    fetch("/api/me").then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(active){setMe(data.user);if(data.user)setColor(data.user.color);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setChecked(true);});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    let active=true;
    import("./scene").then(async({createWorld})=>{
      if(!active||!canvas.current)return;
      const value=await createWorld(canvas.current,(plot,x,z,item)=>{setSelectedPlot(plot);setCell({plot,x,z,item});setGridX(x);setGridZ(z);});
      if(!active){value.dispose();return;}
      scene.current=value;value.world(worldRef.current.plots,worldRef.current.objects);value.players(playersRef.current,myId.current);setReady(true);
    }).catch(error=>{console.error("World graphics initialization failed",error);setError("Your browser could not start 3D graphics. Try updating the browser or enabling hardware acceleration.");});
    return ()=>{active=false;scene.current?.dispose();scene.current=null;};
  },[]);
  useEffect(()=>{
    if(!me||!ready)return;
    let active=true;
    authenticated.current=false;setStatus("Connecting");setError("");
    async function connect(){
      try{
        if(!/^wss?:\/\//.test(websocket))throw new Error("Set NEXT_PUBLIC_WORLD_WS_URL in Vercel and redeploy.");
        const response=await fetch("/api/ticket",{method:"POST"}),result=await response.json();
        if(!response.ok)throw new Error(result.error);
        if(!active)return;
        const ws=new WebSocket(websocket.replace(/\/$/,"")+"/live");socket.current=ws;
        ws.onopen=()=>ws.send(JSON.stringify({type:"auth",ticket:result.ticket}));
        ws.onmessage=event=>{
          if(!active)return;
          const message=JSON.parse(event.data) as Frame;
          if(message.type==="fishing"){setFishing(message.fishing);clockOffset.current=message.fishing.serverNow-Date.now();setClock(message.fishing.serverNow);if(message.result)setCatchResult(message.result);}
          if(message.type==="wallet")setWallet(message.wallet);
          if(message.type==="welcome"){
            authenticated.current=true;setStatus("Connected");myId.current=message.me.id;setMe(message.me);setMessages(message.messages);
          }
          if(message.type==="welcome"||message.type==="world"){
            worldRef.current={plots:message.plots,objects:message.objects};setPlots(message.plots);setItems(message.objects);
            scene.current?.world(message.plots,message.objects);
          }
          if(message.type==="players"){playersRef.current=message.players;setPlayers(message.players);scene.current?.players(message.players,myId.current);}
          if(message.type==="chat")setMessages(list=>[...list,message.message].slice(-60));
          if(message.type==="error"){setError(String(message.message));setSaveStatus("");}
          if(message.type==="saved"){setSaveStatus("Saved");}
        };
        ws.onclose=event=>{authenticated.current=false;if(active){setStatus("Disconnected");setError(event.reason||"Connection interrupted. Reconnect to return to the club.");}};
        ws.onerror=()=>{if(active)setError("Couldn’t reach the multiplayer server. Check its domain and try again.");};
      }catch(e){if(active){setStatus("Disconnected");setError(e instanceof Error?e.message:"Connection failed.");}}
    }
    void connect();
    return ()=>{active=false;authenticated.current=false;socket.current?.close();socket.current=null;};
  },[me?.id,ready,retry,websocket]);
  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{if((event.target as HTMLElement)?.closest("input,textarea,select,button"))return;if(["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)){keys.current.add(event.key);event.preventDefault();}};
    const up=(event:KeyboardEvent)=>keys.current.delete(event.key);
    const clear=()=>{keys.current.clear();stick.current={x:0,z:0};};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",clear);document.addEventListener("visibilitychange",clear);
    const timer=setInterval(()=>{
      if(!authenticated.current||socket.current?.readyState!==WebSocket.OPEN)return;
      const k=keys.current;
      const x=Number(k.has("d")||k.has("ArrowRight"))-Number(k.has("a")||k.has("ArrowLeft"))+stick.current.x;
      const z=Number(k.has("w")||k.has("ArrowUp"))-Number(k.has("s")||k.has("ArrowDown"))+stick.current.z;
      const direction=scene.current?.direction(x,z)??{x,z};
      socket.current.send(JSON.stringify({type:"move",...direction}));
    },100);
    return ()=>{clearInterval(timer);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",clear);document.removeEventListener("visibilitychange",clear);};
  },[]);
  useEffect(()=>{end.current?.scrollIntoView({block:"nearest"});},[messages,expanded,panel]);
  useEffect(()=>{scene.current?.mode(build);},[build,ready]);
  function selectSquare(x:number,z:number){if(!mine||!Number.isInteger(x)||!Number.isInteger(z)||x< -16||x>15||z< -16||z>15)return;const item=items.find(i=>i.plot===mine.id&&i.x===x&&i.z===z);setCell({plot:mine.id,x,z,item:item?.id});scene.current?.select(mine.id,x,z);}
  useEffect(()=>{if(cell){const item=items.find(i=>i.plot===cell.plot&&i.x===cell.x&&i.z===cell.z);if(item?.id!==cell.item)setCell({...cell,item:item?.id});}},[items,cell]);
  useEffect(()=>{const self=players.find(p=>p.id===me?.id);if(connected&&self)music.current?.position(self.x,self.z,volume);else music.current?.position(999,999,0);},[players,me?.id,volume,connected]);
  useEffect(()=>()=>{music.current?.stop();},[]);
  async function toggleMusic(){if(music.current){music.current.stop();music.current=null;setMusicOn(false);return;}try{const sound=createClubMusic();music.current=sound;await sound.resume();setMusicOn(true);}catch{music.current?.stop();music.current=null;setError("Audio could not start. Tap Music again to retry.");}}
  function editPlot(id:number){setFreeCamera(false);setSelectedPlot(id);setCell(null);setBuild(true);scene.current?.mode(true);setPanel("plots");setExpanded(true);scene.current?.plot(id);setPlotName(plots.find(p=>p.id===id)?.name??"");}
  function home(){setFreeCamera(false);setBuild(false);setFreeCamera(false);scene.current?.follow();if(connected)send({type:"home"});}
  function chat(event:FormEvent){event.preventDefault();if(!draft.trim())return;if(send({type:"chat",body:draft})){setDraft("");setError("");}}
  const onStick=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.type==="pointerdown")event.currentTarget.setPointerCapture(event.pointerId);
    if(!event.currentTarget.hasPointerCapture(event.pointerId))return;
    const rect=event.currentTarget.getBoundingClientRect();
    stick.current={x:Math.max(-1,Math.min(1,(event.clientX-rect.left-rect.width/2)/30)),z:Math.max(-1,Math.min(1,-(event.clientY-rect.top-rect.height/2)/30))};
  };
  return <main className="world-app">
    <canvas ref={canvas} aria-label="3D club and neighborhood. Use WASD or arrow keys to move. Drag to rotate the camera." tabIndex={0}/>
    <header className="topbar"><a className="brand" href="/"><span>✦</span><div>CHAOS <b>&</b> CANDY<small>THE NEIGHBORHOOD</small></div></a><div className="connection"><i className={connected?"live":""}/>{me?status:"Explore the club"}<span>· {players.length}/24 online</span></div><div className="account">{me?<><span className="profile-pic">{me.avatar?<img src={me.avatar} alt=""/>:"✦"}</span><strong>{me.name}</strong><button className="wallet-badge" onClick={()=>{setFishOpen(false);setEarn(!earn);}}>{wallet?wallet.balance.toLocaleString():"…"} CB</button><button title="Sign out" aria-label="Sign out" onClick={async()=>{socket.current?.close();const response=await fetch("/api/logout",{method:"POST"});if(response.ok)location.reload();else setError("Sign-out failed. Try again.");}}><LogOut size={17}/></button></>:<a className="primary" href="/api/auth/login">Discord login <ArrowRight size={16}/></a>}</div></header>
    <div className={"location "+(me?"compact":"")}><span className="live-dot"/> {build?"THE NEIGHBORHOOD":"CANDY SHOP"}<h1>{build?"Make yourself at home.":"Your people. Your place."}</h1><p>{build?"Choose a plot, then tap a square to build.":"A little chaos. A lot of good company."}</p></div>
    {error&&<div className="notice" role="alert">{error}<button aria-label="Dismiss message" onClick={()=>setError("")}><X size={16}/></button></div>}
    {checked&&!me&&<section className="welcome"><span className="eyebrow">WELCOME TO YOUR NEXT HANGOUT</span><h2>The night starts here.</h2><p>Meet your Discord friends in the club. Dance, chat, and build a corner of the neighborhood together.</p><a className="primary" href="/api/auth/login">Enter with Discord <ArrowRight size={18}/></a><small>Your server nickname comes with you.</small></section>}
    {me&&<aside className={"panel "+(expanded?"expanded":"")}>
      <div className="panel-tabs">{(["chat","plots","people"] as const).map((name,i)=><button key={name} aria-pressed={panel===name&&expanded} onClick={()=>{setPanel(name);setExpanded(true);}}>{i===0?<MessageCircle size={17}/>:i===1?<Hammer size={17}/>:<Users size={17}/>}<span>{name==="chat"?"Club chat":name==="plots"?"My space":"People"}</span></button>)}<button aria-label={expanded?"Collapse panel":"Expand panel"} onClick={()=>setExpanded(!expanded)}><ChevronDown size={18}/></button></div>
      {expanded&&panel==="chat"&&<><div className="chat-log" aria-label="Chat messages">{!messages.length&&<p className="empty">You’re here. Say hello.</p>}{messages.map(m=><article key={m.id}><strong>{m.name}</strong><time>{new Date(m.created).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time><p>{m.body}</p></article>)}<div ref={end}/></div><form onSubmit={chat} className="chat-input"><input maxLength={300} aria-label="Chat message" placeholder="Say something nice…" value={draft} onChange={e=>setDraft(e.target.value)} disabled={!connected}/><button aria-label="Send message" disabled={!connected||!draft.trim()}><ArrowRight size={19}/></button></form></>}
      {expanded&&panel==="people"&&<div className="panel-body"><h2>In the neighborhood</h2>{players.map(p=><div className="person" key={p.id}><span style={{background:p.color}}>✦</span><div><strong>{p.name}</strong><small>{p.id===me.id?"You":p.emote||"Hanging out"}</small></div>{me.admin&&p.id!==me.id&&<button className="text-button" onClick={()=>{if(window.confirm("Remove "+p.name+" from this world?"))send({type:"ban",user:p.id});}}>Remove</button>}</div>)}<h3>Avatar color</h3><div className="swatches">{COLORS.map(c=><button key={c} aria-label={"Choose "+c} aria-pressed={color===c} style={{background:c}} onClick={()=>{if(send({type:"color",color:c}))setColor(c);}}/>)}</div></div>}
      {expanded&&panel==="plots"&&<div className="panel-body">
        <h2>{mine?"Your place awaits.":"Find your little corner."}</h2><p className="muted">32 × 32 m plots · 1 m grid · 1,000 CB per plot.</p>
        <label>Visit a plot<select value={selectedPlot} onChange={e=>editPlot(Number(e.target.value))}>{plots.map(p=><option key={p.id} value={p.id}>Plot {p.id} · {p.owner?p.owner_name:"Available"}</option>)}</select></label>
        <button className="secondary wide" onClick={()=>editPlot(selectedPlot)}><Move size={16}/> View plot {selectedPlot}</button><button className="secondary wide" disabled={!connected} onClick={()=>{if(send({type:"visit",plot:selectedPlot})){setBuild(false);setFreeCamera(false);scene.current?.follow();}}}>Walk around this plot</button>
        {plot&&!plot.owner&&!mine&&<button className="primary wide" disabled={!connected||!wallet||wallet.balance<1000} onClick={()=>{if(window.confirm("Buy plot "+selectedPlot+" for 1,000 CB?"))send({type:"buy",plot:selectedPlot});}}>Buy plot · 1,000 CB</button>}
        {!mine&&<button className="text-button wide" onClick={()=>{setFishOpen(false);setEarn(true);}}>Balance: {wallet?.balance??0} CB · Earn Chaos Bucks</button>}
        {plot?.owner&&<p className="plot-title">{plot.name}<small>Owned by {plot.owner_name}</small></p>}
        {mine&&mine.id!==selectedPlot&&<button className="secondary wide" onClick={()=>editPlot(mine.id)}>Go to my plot</button>}
        {mine?.id===selectedPlot&&<><form onSubmit={e=>{e.preventDefault();send({type:"rename",name:plotName});}} className="rename"><input aria-label="Plot name" placeholder={mine.name} maxLength={40} value={plotName} onChange={e=>setPlotName(e.target.value)}/><button className="secondary" disabled={!plotName.trim()}>Save</button></form>
          <h3>Build catalog <small>{items.filter(i=>i.plot===mine.id).length}/256</small></h3><div className="catalog">{ITEMS.map(([id,name])=><button aria-pressed={kind===id} key={id} onClick={()=>{setKind(id);setBuild(true);scene.current?.plot(mine.id);}}>{name}</button>)}</div>
          <p className="muted">Choose an item, then tap a grid square. Or choose coordinates below (−16 to 15).</p><div className="coordinates"><label>X<input type="number" min={-16} max={15} value={gridX} onChange={e=>setGridX(Number(e.target.value))}/></label><label>Z<input type="number" min={-16} max={15} value={gridZ} onChange={e=>setGridZ(Number(e.target.value))}/></label><button className="secondary" onClick={()=>{setBuild(true);scene.current?.mode(true);scene.current?.plot(mine.id);selectSquare(gridX,gridZ);}}>Select square</button></div><div className="build-row"><button className="secondary" onClick={()=>setRotation((rotation+90)%360)}><RotateCw size={16}/> {rotation}°</button><span>{cell?.plot===mine.id?"Square "+cell.x+", "+cell.z:"Tap a plot square"}</span></div>
          <button className="primary wide" disabled={!connected||cell?.plot!==mine.id||!!cell?.item} onClick={()=>{if(cell&&send({type:"place",...cell,kind,rotation})){setError("");setSaveStatus("Saving…");}}}>Place {ITEMS.find(i=>i[0]===kind)?.[1]}</button>
          {cell?.item&&cell.plot===mine.id&&<button className="text-button wide" onClick={()=>{send({type:"remove",id:cell.item});setSaveStatus("Saving…");}}>Remove selected object</button>}
          <span role="status" className="save-status">{saveStatus}</span>
        </>}
      </div>}
    </aside>}
    {me&&earn&&<section className="earn-card" aria-label="Chaos Bucks"><button className="close-earn" aria-label="Close Chaos Bucks" onClick={()=>setEarn(false)}><X size={18}/></button><span className="eyebrow">CHAOS BUCKS</span><h2>{wallet?.balance.toLocaleString()??"…"} CB</h2><p>Buy your own 32 × 32 m plot for 1,000 CB.</p><ul><li><strong>500 CB</strong> welcome bonus · once per Discord account</li><li><strong>50 CB</strong> daily check-in · resets at midnight UTC</li><li><strong>10 CB</strong> for each fish sold to Marina</li></ul><button className="primary wide" disabled={!connected||!wallet||wallet.daily} onClick={()=>send({type:"daily"})}>{wallet?.daily?"Today’s check-in collected":"Collect daily 50 CB"}</button><p className="muted">No active-time rewards. Catch fish at the pier and sell them to earn more CB.</p><button className="secondary wide" onClick={()=>{setEarn(false);setFishOpen(true);}}>Open fishing bag</button><small>CB are in-game credits, with no cash value.</small></section>}
    {me&&fishOpen&&<section className="earn-card fishing-card" aria-label="Fishing and inventory"><button className="close-earn" aria-label="Close fishing" onClick={()=>setFishOpen(false)}><X size={18}/></button><span className="eyebrow">CANDY POND</span><h2>Cast. Catch. Collect.</h2><p>Visit the pier, cast your line, wait 12 seconds, then reel in within 30 seconds. One cast every 20 seconds.</p><button className="secondary wide" disabled={!connected} onClick={()=>{if(send({type:"fishing_visit"})){setBuild(false);setFreeCamera(false);scene.current?.follow();}}}>Go to the pier & Marina</button><div className="fish-actions"><button className="primary" disabled={!connected||!fishing||clock<fishing.nextCast||(fishing.ready>0&&clock<=fishing.expires)} onClick={()=>send({type:"cast"})}>Cast line</button><button className="primary" disabled={!connected||!fishing||!fishing.ready||clock<fishing.ready||clock>fishing.expires} onClick={()=>send({type:"reel"})}>Reel in!</button></div><p role="status">{fishing?.ready?(clock<fishing.ready?"Waiting for a bite… "+Math.ceil((fishing.ready-clock)/1000)+"s":clock<=fishing.expires?"Bite! Reel in within "+Math.ceil((fishing.expires-clock)/1000)+"s.":"The fish escaped. Cast again."):fishing&&clock<fishing.nextCast?"Next cast in "+Math.ceil((fishing.nextCast-clock)/1000)+"s.":"Ready to cast at the pier."}</p><p className="catch-result" role="status">{catchResult}</p><h3>Your fishing bag</h3><p>🐟 {fishing?.fish??0} fish · 10 CB each</p><button className="secondary wide" disabled={!connected||!fishing?.fish} onClick={()=>send({type:"sell_fish"})}>Sell all to Marina · {(fishing?.fish??0)*10} CB</button><h3>Rare dance: Neon Spin</h3><p>{fishing?.dance?"Unlocked permanently! Use it anywhere in the world.":"3% chance per catch. Once unlocked, further catches give fish."}</p><button className="primary wide" disabled={!connected||!fishing?.dance} onClick={()=>send({type:"emote",emote:"neon_spin"})}>{fishing?.dance?"Dance · Neon Spin":"Neon Spin · Locked"}</button><small>Fish are only for selling to Marina for now. Player-to-player trading is not enabled.</small></section>}
    <div className="camera-tools"><button onClick={()=>{if(freeCamera)scene.current?.follow();else scene.current?.explore();setFreeCamera(!freeCamera);}}>{freeCamera?"Follow my avatar":"Pan whole world"}</button><small>{freeCamera?"Drag to pan · right-drag to rotate":"Drag to rotate · right-drag / Ctrl-drag to pan"}<br/>Touch: pinch to zoom · two fingers to pan</small></div>
    {me&&<div className="audio-controls"><button aria-pressed={musicOn} onClick={toggleMusic}>{musicOn?"Mute music":"Enable music"}</button>{musicOn&&<label>Volume<input aria-label="Music volume" type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>}<small>Club audio · fades out at 28 m</small></div>}
    <footer className="toolbar"><button onClick={home}><Home size={18}/><span>Club</span></button>{me&&<><button onClick={()=>editPlot(mine?.id??selectedPlot)}><Hammer size={18}/><span>Build</span></button><button onClick={()=>send({type:"emote",emote:"dance"})}><Music2 size={18}/><span>Dance</span></button><button onClick={()=>send({type:"emote",emote:"wave"})}><Sparkles size={18}/><span>Wave</span></button><button onClick={()=>{setEarn(false);setFishOpen(!fishOpen);}}><span>♓</span><span>Fish</span></button><button onClick={()=>send({type:"emote",emote:"sit"})}><span>↓</span><span>Sit</span></button></>}{me&&!connected&&<button onClick={()=>setRetry(x=>x+1)}><RefreshCw size={18}/><span>Reconnect</span></button>}</footer>
    {me&&<div className="joystick" aria-label="Touch movement control" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={()=>stick.current={x:0,z:0}} onPointerCancel={()=>stick.current={x:0,z:0}} onLostPointerCapture={()=>stick.current={x:0,z:0}}><span>✥</span></div>}
    <div className="controls-hint">WASD / arrows to move <span>·</span> Drag to look <span>·</span> Scroll to zoom</div>
  </main>;
}
