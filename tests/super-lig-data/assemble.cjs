'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const dir=path.resolve(process.argv[2]);
const parent=path.resolve(__dirname,'..');
const root=fs.existsSync(path.join(parent,'index.html'))?parent:path.resolve(parent,'..');
const app=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const m=new Function(app+';return {clubModelKey,csv,scheduleStrength};')();
const {features:rows}=JSON.parse(fs.readFileSync(path.join(dir,'features.json')));
const src=JSON.parse(fs.readFileSync(process.argv[3]));
const tff=JSON.parse(fs.readFileSync(path.join(dir,'tff-results.json'))).matches;
const aliases={
 addemirspor:'adanademirspor',gaziantepfk:'gaziantep',erzurumbb:'erzurumspor',
 buyuksehyr:'basaksehir',bbbodrumspor:'bodrumspor',goztep:'goztepe',
 karagumruk:'fatihkaragumruk',karagumruksk:'fatihkaragumruk',
 rizespor:'caykurrizespor',antalya:'antalyaspor',erzurum:'erzurumspor',
 bberzurumspor:'erzurumspor',eyup:'eyupspor',gaziantepbb:'gaziantep',buyuksehir:'basaksehir',
 bodrum:'bodrumspor',yms:'yenimalatyaspor'
};
const name=value=>{const k=m.clubModelKey(value);return aliases[k]??k;};
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'});
const sourceIndex=new Map();
for(const r of src){
 const id=[day.format(new Date(r.kickoff)),name(r.home),name(r.away),r.h,r.a].join('|');
 if(!sourceIndex.has(id))sourceIndex.set(id,[]);
 sourceIndex.get(id).push(r);
}
function lookup(row){
 const choices=sourceIndex.get([row.date,name(row.home),name(row.away),row.h,row.a].join('|'));
 return choices?.length===1?choices[0]:null;
}
const official=[
 ...m.csv(fs.readFileSync(path.join(dir,'turkey.csv'),'utf8')).filter(row=>row.tier==='1'&&+row.Season>=2015)
   .map(row=>({year:+row.Season,date:row.Date,home:name(row.home),away:name(row.visitor),h:+row.hgoal,a:+row.vgoal})),
 ...tff.map(row=>({year:2025,date:row.date,home:name(row.home),away:name(row.away),h:row.score[0],a:row.score[1]})),
];
const progress={};
const window=[90,180,360];
const stats=['shots_on_goal','shots_inside_box','xg'];
const cleaned=r=>stats.map((metric,i)=>{
 const values=['home','away'].map(side=>r[side+'_'+metric]);
 return values.every(value=>Number.isFinite(value)&&value>=0&&value<=(i===2?6:50))&&values.some(value=>value>0)?values:null;
});
const matches=[];
for(const match of official){
 const source=lookup(match);
 const p=progress[match.year]??={fixtures:0,match:0,sot:0,box:0,proxy:0,formations:0};
 p.fixtures++;
 if(!source)continue;
 const stat=cleaned(source),known=Date.parse(source.known);
 if(!Number.isFinite(known)||known<Date.parse(source.kickoff)+90*60000)continue;
 p.match++;
 for(const [i,field] of ['sot','box','proxy'].entries())p[field]+=Number(stat[i]!=null);
 p.formations+=Number(source.formations);
 matches.push({...match,known,stat});
}
const intervals=new Map();
for(const r of rows.filter(r=>r.year>=2015)){
 const items=intervals.get(r.date)||[];
 items.push(r);intervals.set(r.date,items);
}
const out=[];
for(const [date,items] of intervals){
 const end=Date.parse(date+'T00:00:00+03:00');
 const history=matches.filter(row=>row.date<date&&row.known<end&&row.known>=end-730*86400000);
 assert.ok(history.every(row=>row.date<date&&row.known<end));
 const analyses=stats.map((_,i)=>{
  const observed=history.filter(row=>row.stat[i]);
  const counts=new Map();
  let goals=0,sum=0;
  for(const row of observed){
   counts.set(row.home,(counts.get(row.home)||0)+1);counts.set(row.away,(counts.get(row.away)||0)+1);
   goals+=row.h+row.a;sum+=row.stat[i][0]+row.stat[i][1];
  }
  const values=observed.map(row=>({...row,ft_home:row.stat[i][0],ft_away:row.stat[i][1]}));
  return {counts,scale:sum?(goals+12)/(sum+12*(i===0?3:i===1?5:1)):1,
   fits:window.map(days=>m.scheduleStrength(values,days,date))};
 });
 for(const row of items){
  const signals=analyses.map(({counts,scale,fits})=>{
   if(Math.min(counts.get(row.home)||0,counts.get(row.away)||0)<8)return null;
   return fits.map(fit=>{
    const h=fit.teams.get(row.home),a=fit.teams.get(row.away);
    return [fit.home*h.attack*a.defense,fit.away*a.attack*h.defense].map(value=>Math.min(6,Math.max(.08,value*scale)));
   });
  });
  if(signals[0]&&signals[1])out.push({...row,signals});
 }
}
process.stdout.write(JSON.stringify({coverage:progress,features:out}));
