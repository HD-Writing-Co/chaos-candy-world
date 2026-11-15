import World from "./world";
export default function Page(){return <World websocket={process.env.NEXT_PUBLIC_WORLD_WS_URL??""}/>;}
