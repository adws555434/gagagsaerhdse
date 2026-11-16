import {ASSUMED_EFFECTS} from '../sim/event-engine.mjs';

const aliases={
 'Beşiktaş JK':'Besiktas','Başakşehir FK':'Basaksehir','Akhisarspor':'Akhisar Belediyespor',
 'Erzurumspor FK':'Erzurumspor','Kayseri Erciyesspor':'Erciyesspor',
 'Istanbul BBSK':'Basaksehir','İstanbul BB':'Basaksehir','İstanbul Başakşehir FK':'Basaksehir',
 'Gaziantep FK':'Gaziantep','Büyükşehir Belediye Erzurumspor':'Erzurumspor',
 'MKE Ankaragücü':'Ankaragucu','Gençlerbirliği SK':'Genclerbirligi','Çaykur Rizespor':'Caykur Rizespor',
 'İstanbulspor':'Istanbulspor','Akhisar Belediyespor':'Akhisarspor','Akhisar Belediye':'Akhisarspor'
};
const fitMinimum=100;

export function matchEventArchive(matches,cases,key){
 const caseKey=({date,home,away,h,a})=>[date,home,away,h,a].join('|');
 const predictions=new Map(cases.map(match=>[caseKey(match.row),match.input]));
 return matches.flatMap(([stamp,home,away,h,a,reds,eligible,exposure])=>{
  const date=stamp.slice(0,10);
  const resolve=name=>key(name==='Sincan Belediyesi Ankaraspor'&&date>='2014-08-01'&&date<'2020-09-01'
   ?'Osmanlispor':aliases[name]??name);
  const input=predictions.get(caseKey({date,home:resolve(home),away:resolve(away),h,a}));
  if(!input)return [];
  return [{date,reds,eligible,exposure:exposure.map(([side,segment,status,own,opp,time,goals])=>{
   const state=(segment>=3?1:0);
   const features=[side,segment+2];
   if(status!==0)features.push((status<0?8:10)+state);
   if(own)features.push(12);
   if(opp)features.push(13);
   return [features,time*input.rates[side],goals];
  })}];
 }).sort((a,b)=>a.date.localeCompare(b.date));
}

function fit(cells,reds,eligible){
 const terms=new Float64Array(14).fill(1);
 const entries=[...cells.values()];
 // Penalized multiplicative Poisson fit with pre-match goal-rate offsets.
 for(let pass=0;pass<20;pass++)for(let j=0;j<terms.length;j++){
  let target=12, total=12;
  for(const [features,offset,goals] of entries){
   if(!features.includes(j))continue;
   target+=goals;
   total+=offset*features.reduce((product,k)=>product*(j===k?1:terms[k]),1);
  }
  terms[j]=target/total;
 }
 const segments=Array.from(terms.slice(2,8));
 const scale=segments.reduce((a,b)=>a+b,0)/segments.length;
 return {segments:segments.map(p=>p/scale),pursuit:[terms[8],terms[9]],ahead:[terms[10],terms[11]],
  ownRed:terms[12],opponentRed:terms[13],redRate:(reds+ASSUMED_EFFECTS.redRate*50)/(eligible+50)};
}

export function chronologicalEventFit(matches){
 const cells=new Map();
 let month='',index=0,reds=0,eligible=0,params=ASSUMED_EFFECTS,fitted=0;
 return {
  at(date){
   const next=date.slice(0,7);
   if(next===month)return params;
   if(next<month)throw Error('Olay parametreleri kronolojik sırada hesaplanmalı.');
   month=next;
   while(matches[index]?.date.slice(0,7)<month){
    const match=matches[index++];
    reds+=match.reds;eligible+=match.eligible;
    for(const [features,offset,goals] of match.exposure){
     const key=features.join(',');
     if(!cells.has(key))cells.set(key,[features,0,0]);
     const row=cells.get(key);
     row[1]+=offset;row[2]+=goals;
    }
   }
   if(index>=fitMinimum){params=fit(cells,reds,eligible);fitted=index;}
   return params;
  },
  count:()=>fitted
 };
}
