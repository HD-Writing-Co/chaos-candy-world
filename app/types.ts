export type Player={id:string;name:string;avatar?:string;admin?:boolean;color:string;x:number;z:number;rotation:number;emote:string};
export type Plot={id:number;owner:string|null;owner_name:string|null;name:string};
export type Item={id:string;plot:number;kind:string;x:number;z:number;rotation:number};
export type Message={id:string;name:string;body:string;created:number};
export const COLORS=["#cf7aff","#ff75b9","#5ce4d0","#f9c46a","#7ba7ff"];
export const ITEMS=[["wall","Wall"],["floor","Floor tile"],["chair","Chair"],["table","Table"],["lamp","Neon lamp"],["tree","Tree"],["booth","Market stall"]];
export const plotPosition=(id:number)=>({x:((id-1)%4)*44-66,z:id<=4?70:-70});
