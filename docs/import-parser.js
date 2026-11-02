import {catalog,partFor} from './catalog.js';
const names=Object.values(catalog).flat();
export function parseWorkoutImage(text){
 const normalized=String(text).normalize('NFKC').replace(/[×✕✖]/g,'x').replace(/[，,](?=\d{3}\b)/g,'').replace(/[‐−–]/g,'-');
 const match=normalized.match(/(20\d{2})\s*[/.年-]\s*(\d{1,2})\s*[/.月-]\s*(\d{1,2})/);let day='';const warnings=[];
 if(match){const candidate=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`,date=new Date(candidate+'T12:00:00');if(!Number.isNaN(date.getTime())&&date.toLocaleDateString('sv-SE')===candidate)day=candidate}
 if(!day)warnings.push('日付を読み取れませんでした。日付を入力してください。');
 const items=[];let current=null,pending='';
 for(const raw of normalized.split(/\n/)){let line=raw.trim();if(!line)continue;
  const sets=[...line.matchAll(/(\d+(?:\s*\.\s*\d+)?)\s*k\s*g\s*x\s*(\d+)\s*(?:reps?\b|回)/gi)];
  if(sets.length){if(!current){current={name:pending,part:partFor(pending),sets:[]};items.push(current)}for(const m of sets){const weight=Number(m[1].replace(/\s/g,'')),reps=Number(m[2]);if(weight>1000||reps<1||reps>999){warnings.push('範囲外の重量・回数があり、取り込めませんでした。元画像と照合してください。');continue}current.sets.push({weight,reps})}continue}
  if(/Work\s*Out|Powered|筋トレ\s*MEMO|20\d{2}\s*[/.年-]|^\s*(?:MAX\s*)?(?:1?RM)\s*[:：]|^\d+\s*$/i.test(line))continue;
  line=line.replace(/\s*(?:1?RM)\s*[:：].*$/i,'').trim();if(!line)continue;
  if(/kg|reps|MAX\s*RM/i.test(line)){warnings.push('読み取れなかった行があります。元画像とセット数を照合してください。');continue}
  let name=line.replace(/\s+/g,'');name=names.find(n=>n.replace(/\s/g,'')===name)||name;
  if(name.length>60){warnings.push('種目名を確認してください。');name=name.slice(0,60)}
  if(current?.sets.length)current=null;
  pending=name;current={name,part:partFor(name),sets:[]};items.push(current);
 }
 const result=items.filter(x=>x.sets.length);if(result.some(x=>!x.name))warnings.push('種目名を入力してください。');
 if(!result.length)throw Error('セットを読み取れませんでした。筋トレMEMOの「その日の記録」の画像を選んでください。');
 if(result.length>30||result.some(x=>x.sets.length>50))throw Error('1回に取り込めるのは30種目・各50セットまでです。画像を分けてください。');
 return {day,items:result,warnings:[...new Set(warnings)]};
}
export function workoutSignature(day,items){return JSON.stringify({day,items:items.map(x=>({name:x.name.normalize('NFKC').replace(/\s/g,''),sets:x.sets.map(s=>[Number(s.weight),Number(s.reps)])})).sort((a,b)=>a.name.localeCompare(b.name))})}
export async function sha256(value){const bytes=typeof value==='string'?new TextEncoder().encode(value):value;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function importRecordId(user,group,key){const h=await sha256(`${user}:${group}:${key}`);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`}
