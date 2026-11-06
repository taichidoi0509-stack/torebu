import {partFor,catalog} from './catalog.js';
const names=Object.values(catalog).flat();
const cleanName=s=>{const n=s.replace(/^[\s#>*・●\-]+/g,'').replace(/^\d+[.)、]\s*/,'').replace(/[：:]\s*$/,'').trim();return names.find(x=>x.replace(/\s/g,'')===n.replace(/\s/g,''))||n};
export function parseWorkoutText(input){
 const text=String(input).normalize('NFKC').replace(/\r/g,'').replace(/\*\*|__/g,'').replace(/^\s*\*\s+/gm,'- ').replace(/[×✕✖＊*]/g,'x').replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1');
 if(text.length>30000)throw Error('1日分の記録を30,000文字以内で貼り付けてください。');
 const dates=[...text.matchAll(/(20\d{2})\s*[/.年-]\s*(\d{1,2})\s*[/.月-]\s*(\d{1,2})/g)].map(m=>`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`),unique=[...new Set(dates)];
 if(unique.length>1)throw Error('複数の日付があります。1日分ずつ貼り付けてください。');
 let day=unique[0]||'';const warnings=[];if(day){const date=new Date(day+'T12:00:00');if(Number.isNaN(date.getTime())||date.toLocaleDateString('sv-SE')!==day)day=''}
 if(!day)warnings.push('日付を読み取れませんでした。日付を入力してください。');
 const items=[];let current=null,headers=null;let skipped=0;
 function add(name,weight,reps,count=1){name=cleanName(name);if(!name)name=current?.name||'';weight=Number(weight);reps=Number(reps);count=Number(count);if(!Number.isFinite(weight)||weight<0||weight>1000||Math.abs(weight*10-Math.round(weight*10))>1e-7||!Number.isInteger(reps)||reps<1||reps>999||!Number.isInteger(count)||count<1||count>50)throw Error('重量は0〜1000kgの小数点第一位まで、回数は1〜999回、セット数は1〜50で指定してください。');
  if(!current||current.name!==name){current={name,part:partFor(name),sets:[]};items.push(current)}if(current.sets.length+count>50)throw Error('1種目は50セットまでです。');for(let i=0;i<count;i++)current.sets.push({weight,reps});
 }
 for(const raw of text.split('\n')){let line=raw.trim();if(!line||/^```|^[-:=|\s]+$/.test(line))continue;
  if(line.includes('|')){const cells=line.replace(/^\||\|$/g,'').split('|').map(x=>x.trim());const head={name:cells.findIndex(x=>/種目|exercise/i.test(x)),weight:cells.findIndex(x=>/重量|weight/i.test(x)),reps:cells.findIndex(x=>/回数|reps/i.test(x)),sets:cells.findIndex(x=>/セット|sets/i.test(x))};if(head.name>=0&&head.weight>=0&&head.reps>=0){headers=head;continue}
   if(headers){const number=(value,unit)=>String(value||'').replace(unit,'').trim();add(cells[headers.name],number(cells[headers.weight],/kg|キロ/ig),number(cells[headers.reps],/回|reps?/ig),headers.sets<0?1:number(cells[headers.sets],/セット|sets?/ig));continue}
  }
  if(/20\d{2}\s*[/.年-]\s*\d{1,2}\s*[/.月-]\s*\d{1,2}/.test(line)&&!/kg|キロ/i.test(line))continue;
  if(/(?:推定\s*)?1\s*RM|総負荷|合計|総セット|総ボリューム|消費カロリー|目標|次回|前回|予定|ウォームアップを除く/i.test(line)){if(/kg|回|セット/i.test(line))skipped++;continue}
  // Explicit kg and 回/reps keep dates, RM values and commentary out of sets.
  const rows=[...line.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:kg|キロ)\s*(?:x|[:：])?\s*(\d+(?:\s*[/,・]\s*\d+)*)\s*(?:回|reps?\b)(?:\s*(?:x|を|[/／])?\s*(-?\d+(?:\.\d+)?)\s*(?:セット|sets?\b))?/gi)];
  if(rows.length){let prefix=cleanName(line.slice(0,rows[0].index));if(/^(?:\d+\s*セット(?:目)?|set\s*\d+|\d+)\s*[:：.)-]?$/i.test(prefix))prefix='';const name=prefix||current?.name||'';
   for(const row of rows){const repetitions=row[2].split(/[/,・]/).map(x=>x.trim());for(const rep of repetitions)add(name,row[1],rep,row[3]||1)}
   const unparsed=line.replace(/\([^)]*\)/g,'').replace(/（[^）]*）/g,'');if((unparsed.match(/kg|キロ/gi)||[]).length>rows.length)skipped++;continue;
  }
  if(/kg|キロ|\d+\s*(?:回|reps?\b|セット)/i.test(line)){skipped++;continue}
  if(/^(?:メモ|感想|休憩|RPE|疲労|ポイント|補足)\s*[:：]/i.test(line))continue;
  if(/^[#>*\-・●\s]*\d+[.)、]?\s*$/.test(line))continue;
  const name=cleanName(line);if(name&&name.length<=60){current={name,part:partFor(name),sets:[]};items.push(current)}
 }
 const result=items.filter(x=>x.sets.length);if(!result.length)throw Error('記録を読み取れませんでした。「ベンチプレス 50.3kg × 10回 × 3セット」のように、種目・重量・回数を書いてください。');
 if(result.length>30)throw Error('1回に取り込めるのは30種目までです。');
 if(result.some(x=>x.name.length>60))throw Error('種目名は60文字以内にしてください。');
 if(result.some(x=>!x.name))warnings.push('種目名を読み取れませんでした。種目名を入力してください。');
 if(skipped)warnings.push(`${skipped}行を記録に含めていません。まとめ・予定・読み取れない行があるため、貼り付けた内容とセット数を照合してください。`);
 return {day,items:result,warnings};
}
export const GPT_EXPORT_PROMPT=`今日実施した筋トレの記録を、次の形式のテキストだけで出してください。
日付は YYYY/MM/DD。各行は「種目名 重量kg × 回数回 × セット数セット」。重量は小数点第一位まで。
重量・回数が異なるセットは別行にしてください。同じ種目名を繰り返して構いません。
予定・提案・推定1RM・総負荷量・感想は含めず、不明な値を推測しないでください。自重種目は追加重量を使い、不明な値は先に私に確認してください。

例：
2026/11/06
ベンチプレス 50.3kg × 10回 × 3セット
ラットプルダウン 40kg × 12回 × 2セット`;
