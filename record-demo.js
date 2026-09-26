import {windowMetrics,pricePoints} from './metrics.js';

const DURATION_SECONDS=125;
const chapters=[
  {until:22,title:'A live window into Solana',body:'Pool Signal subscribes to Solami Blur for one token mint on mainnet. No trades or wallet signatures are needed.'},
  {until:47,title:'One filtered stream, several signals',body:'Swaps, liquidity changes, radar, surge and metadata flow through the same Solami WebSocket connection.'},
  {until:74,title:'Every number has a boundary',body:'Volume, trade count, buy/sell ratio and price points describe only events this tab actually received.'},
  {until:101,title:'Inspect the chain evidence',body:'Signed swaps link to Solscan. The transaction signatures below are from the live feed, not sample data.'},
  {until:126,title:'Missing data stays visible',body:'Feed silence and connection gaps are explicit. Zero observed events never proves zero market activity.'}
];

function rect(ctx,x,y,w,h,fill,r=0){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function label(ctx,text,x,y,size=16,color='#dce9dc',weight=400,font='Arial') {ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${font}`;ctx.fillText(text,x,y);}
function wrap(ctx,text,x,y,width,lineHeight){let line='',cursor=y;for(const word of text.split(' ')){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,cursor);line=word;cursor+=lineHeight;}else line=next;}if(line)ctx.fillText(line,x,cursor);}
function cash(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:value<1?4:0}).format(value);}

function draw(ctx,getState,elapsed){
  const state=getState(),now=Date.now(),metrics=windowMetrics(state.events,now),prices=pricePoints(state.events,now,90);
  const chapter=chapters.find(item=>elapsed<item.until)||chapters.at(-1);
  rect(ctx,0,0,1280,720,'#0b1012');
  const glow=ctx.createRadialGradient(1080,30,40,1080,30,700);glow.addColorStop(0,'#20382b');glow.addColorStop(1,'#0b1012');rect(ctx,0,0,1280,720,glow);
  rect(ctx,48,40,1184,1,'#304237');label(ctx,'◉  POOL SIGNAL',50,31,18,'#b9fa67',700);label(ctx,'SOLANA MAINNET  /  LIVE DEMO',896,31,13,'#b5c8b0',600);
  label(ctx,chapter.title,50,104,37,'#f1f9ed',700);
  ctx.font='17px Arial';ctx.fillStyle='#9cad9e';wrap(ctx,chapter.body,50,138,1130,25);
  rect(ctx,50,190,1180,63,'#14201c',10);rect(ctx,67,212,10,10,state.socket?.readyState===WebSocket.OPEN?'#b9fa67':'#e1b070',5);
  label(ctx,state.socket?.readyState===WebSocket.OPEN?'LIVE SOLAMI BLUR STREAM':'FEED DISCONNECTED',88,222,15,'#d8eacb',700);
  label(ctx,`JUP  ·  ${state.mint?.slice(0,8)||'—'}…${state.mint?.slice(-8)||'—'}`,440,222,14,'#8fa894');
  label(ctx,new Date(now).toISOString().replace('T',' ').slice(0,19)+' UTC',917,222,14,'#a1b6a1');
  const cards=[['OBSERVED SWAP VOLUME',cash(metrics.volume)],['BUY / SELL USD',metrics.ratio===null?'—':`${metrics.ratio.toFixed(2)}×`],['SWAPS SEEN',String(metrics.swaps)],['LIQUIDITY REMOVALS',String(metrics.removals)]];
  cards.forEach(([name,value],i)=>{const x=50+i*301;rect(ctx,x,275,280,119,'#121d19',10);label(ctx,name,x+18,306,12,'#8ca38e',600);label(ctx,value,x+18,366,36,i===3?'#ffd18f':'#eaf4e3',700);});
  rect(ctx,50,414,725,214,'#111b19',10);label(ctx,'OBSERVED PRICE TRACE · LAST 5 MIN',70,444,12,'#8ca38e',600);
  if(prices.length){label(ctx,cash(prices.at(-1)),600,445,17,'#b9fa67',700);const low=Math.min(...prices),high=Math.max(...prices),span=high-low||high*.001||1;ctx.beginPath();prices.forEach((price,i)=>{const x=73+(prices.length===1?320:i*680/(prices.length-1)),y=596-(price-low)/span*125;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.strokeStyle='#b9fa67';ctx.lineWidth=3;ctx.stroke();}
  else label(ctx,'Waiting for observed swap prices',74,540,18,'#728779');
  rect(ctx,794,414,436,214,'#111b19',10);label(ctx,'LATEST SIGNED EVENTS',813,444,12,'#8ca38e',600);
  const signed=state.events.filter(item=>typeof item.event.signature==='string').slice(-4).reverse();
  signed.forEach((item,i)=>{const y=478+i*39;rect(ctx,813,y-16,398,1,'#2b3b31');label(ctx,`${item.event.type.toUpperCase()}  ${(item.event.side||'').toUpperCase()}`,813,y+8,13,'#e1ecdc',600);label(ctx,`${item.event.signature.slice(0,11)}…`,1059,y+8,12,'#a9d77c');});
  if(!signed.length)label(ctx,'Waiting for signed events',813,503,14,'#718675');
  label(ctx,`Observed events this session: ${state.total}   ·   Connection gaps: ${state.gaps}`,50,661,14,'#a2b4a0');
  label(ctx,`LIVE MAINNET DATA  ·  ${Math.min(DURATION_SECONDS,Math.floor(elapsed))}/${DURATION_SECONDS}s`,930,661,13,'#b9fa67',600);
  rect(ctx,50,681,1180,4,'#263729',2);rect(ctx,50,681,1180*Math.min(1,elapsed/DURATION_SECONDS),4,'#b9fa67',2);
  label(ctx,'Read-only market telemetry. Figures are observed, not comprehensive. No investment advice.',50,706,11,'#6e8571');
}

export async function recordDemo(getState,onProgress){
  if(typeof MediaRecorder!=='function')throw new Error('MediaRecorder is unavailable in this browser');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)throw new Error('WebM recording is unavailable');
  const stream=canvas.captureStream(12),recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1_000_000});
  const chunks=[];recorder.addEventListener('dataavailable',event=>{if(event.data.size)chunks.push(event.data);});
  const done=new Promise((resolve,reject)=>{recorder.addEventListener('stop',resolve,{once:true});recorder.addEventListener('error',event=>reject(event.error||new Error('Recorder error')),{once:true});});
  const started=performance.now();draw(ctx,getState,0);recorder.start(1000);
  const timer=setInterval(()=>{const elapsed=(performance.now()-started)/1000;draw(ctx,getState,elapsed);onProgress(Math.min(DURATION_SECONDS,Math.floor(elapsed)));if(elapsed>=DURATION_SECONDS){clearInterval(timer);recorder.stop();}},100);
  await done;stream.getTracks().forEach(track=>track.stop());
  const blob=new Blob(chunks,{type:mime});if(blob.size<50_000)throw new Error('Video output was unexpectedly small');
  const objectUrl=URL.createObjectURL(blob);const link=document.createElement('a');link.href=objectUrl;link.download='pool-signal-live-mainnet-demo.webm';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60_000);
  return {bytes:blob.size,durationSeconds:DURATION_SECONDS};
}
