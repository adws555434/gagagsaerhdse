export const SCOPE = 'TUR_1_super-lig';
export const VERSION = '2026.11-super-lig-events-v1';
export const TRIALS = 100_000_000;
export const BLOCK = 1_000_000;
export const DAY = 86_400_000;
const source = 'https://raw.githubusercontent.com/jalapic/engsoccerdata/6a99aed7ecf5949008f6276512b1248cf53d6701/data-raw/turkey.csv';
export const ARCHIVE_SOURCE = {url:source, sha:'cb1d8d58a99213d4b6bcb44a54f5f0f4de0127771171e7969043b59837993a54'};
const aliases = {
 addemirspor:'adanademirspor',antalya:'antalyaspor',erzurum:'erzurumspor',bberzurumspor:'erzurumspor',
 eyup:'eyupspor',gaziantepbb:'gaziantep',gaziantepfk:'gaziantep',goztep:'goztepe',karagumruksk:'fatihkaragumruk',
 karagumruk:'fatihkaragumruk',buyuksehyr:'basaksehir',buyuksehir:'basaksehir',istanbulbasaksehir:'basaksehir',
 rizespor:'caykurrizespor',bodrum:'bodrumspor',bodrumfk:'bodrumspor',yms:'yenimalatyaspor'
};
export function historyKey(name, normalize) {
 const key=normalize(name);
 return aliases[key]??key;
}
export function dayNumber(date) {return Date.parse(date+'T00:00:00Z') / DAY;}
export function historyRows(rows, normalize) {
 const valid=new Map();
 for(const row of rows){
  if(!/^\d{4}-\d\d-\d\d$/.test(row.date)||!Number.isInteger(dayNumber(row.date)))continue;
  const home=historyKey(row.home,normalize),away=historyKey(row.away,normalize);
  const validScore=x=>/^(?:0|[1-9]\d*)$/.test(String(x))&&Number(x)<=30;
  if(!home||!away||home===away||!validScore(row.ft_home)||!validScore(row.ft_away))continue;
  const [h,a]=[Number(row.ft_home),Number(row.ft_away)];
  const key=[row.date,home,away].join('|');
  valid.set(key,{date:row.date,day:dayNumber(row.date),home,away,h,a,homeName:row.home,awayName:row.away});
 }
 return [...valid.values()].sort((a,b)=>a.day-b.day||a.home.localeCompare(b.home)||a.away.localeCompare(b.away));
}
export function archiveCsv(csv,text) {
 return csv(text).filter(row=>row.tier==='1').map(row=>({
  date:row.Date,home:row.home,away:row.visitor,ft_home:row.hgoal,ft_away:row.vgoal
 }));
}

const halfLives=[90,180,360,720];
const priors=[4,10,20];
const rhos=Array.from({length:13},(_,i)=>(i-6)*.04);
const settings=halfLives.flatMap(half=>priors.flatMap(prior=>rhos.map(rho=>({half,prior,rho}))));
const fallback=settings.findIndex(x=>x.half===360&&x.prior===10&&x.rho===0);
const minimumFit=100;
const logFact=Array.from({length:31},(_,i)=>Array.from({length:i},(__,j)=>Math.log(j+1)).reduce((a,b)=>a+b,0));
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const factor=(age,half)=>2**(-age/half);

function decayed(value,day,half) {
 if(!value)return [0,0,0];
 const scale=factor(day-value.day,half);
 return value.totals.map(x=>x*scale);
}
function add(map,key,day,half,h,a){
 const [n,x,y]=decayed(map.get(key),day,half);
 map.set(key,{day,totals:[n+1,x+h,y+a]});
}
export function dcFactor(h,a,rateH,rateA,rho) {
 const safe=clamp(rho,-.95/Math.max(rateH,rateA),.95/Math.max(1,rateH*rateA));
 if(h===0&&a===0)return 1-rateH*rateA*safe;
 if(h===0&&a===1)return 1+rateH*safe;
 if(h===1&&a===0)return 1+rateA*safe;
 if(h===1&&a===1)return 1-safe;
 return 1;
}
function estimates(state,home,away,day,prior) {
 const [n,scoredHome,scoredAway]=decayed(state.teams.get(''),day,state.half);
 const mh=(scoredHome+1.4*prior)/(n+prior),ma=(scoredAway+1.1*prior)/(n+prior);
 const mean=(mh+ma)/2;
 const team=name=>{
  const [matches,gf,ga]=decayed(state.teams.get(name),day,state.half);
  return {matches,attack:(gf+mean*prior)/(matches+prior)/mean,defense:(ga+mean*prior)/(matches+prior)/mean};
 };
 const h=team(home),a=team(away);
 return {rates:[clamp(mh*h.attack*a.defense,.05,6),clamp(ma*a.attack*h.defense,.05,6)],
  effective:[h.matches+prior,a.matches+prior]};
}
export function trainChronologically(rows,onPrediction=()=>{},prior=null) {
 const states=halfLives.map((half,i)=>({half,teams:new Map(prior?.states[i]??[])}));
 const strengthModels=states.flatMap(state=>priors.map(prior=>[state,prior]));
 const counts=new Map(prior?.counts??[]),errors=new Float64Array(prior?.errors??settings.length);
 let previous=prior?.previous??-Infinity, fitted=prior?.fitted??0;
 const best=()=>fitted<minimumFit?fallback:errors.indexOf(Math.min(...errors));
 function current(home,away,day,index=best()){
  if(!(day>previous)||!Number.isFinite(day))throw Error('Tahmin tarihi arşiv kesiminden sonra olmalı.');
  if(home===away||(counts.get(home)??0)<5||(counts.get(away)??0)<5)return null;
  const setting=settings[index];
  const {rates,effective}=estimates(states[halfLives.indexOf(setting.half)],home,away,day,setting.prior);
  return {rates,rho:setting.rho,setting,training:fitted,
   uncertainty:effective.map(n=>Math.min(.35,1/Math.sqrt(n)))};
 }
 for(let start=0;start<rows.length;){
  const {day}=rows[start];
  if(day<=previous)throw Error('Geçmiş maçlar kronolojik sırada olmalı.');
  let end=start+1;
  while(rows[end]?.day===day)end++;
  const index=best(),pending=[];
  for(let i=start;i<end;i++){
   const row=rows[i], input=current(row.home,row.away,day,index);
   if(!input)continue;
   onPrediction(row,input);
   pending.push(row);
  }
  for(const {home,away,h,a} of pending){
   for(const [j,[state,prior]] of strengthModels.entries()){
    const {rates:[rh,ra]}=estimates(state,home,away,day,prior);
    const poisson=rh+ra-h*Math.log(rh)-a*Math.log(ra)+logFact[h]+logFact[a];
    for(const [k,rho] of rhos.entries())errors[j*rhos.length+k]+=poisson-Math.log(dcFactor(h,a,rh,ra,rho));
   }
   fitted++;
  }
  for(let i=start;i<end;i++){
   const {home,away,h,a}=rows[i];
   for(const state of states){
    add(state.teams,'',day,state.half,h,a);
    add(state.teams,home,day,state.half,h,a);
    add(state.teams,away,day,state.half,a,h);
   }
   counts.set(home,(counts.get(home)??0)+1);
   counts.set(away,(counts.get(away)??0)+1);
  }
  previous=day;
  start=end;
 }
 return {current,snapshot:()=>({previous,fitted,counts:[...counts],errors:[...errors],
  states:states.map(state=>[...state.teams])})};
}
export function withMarket(input,market) {
 if(!market)return input;
 // Geometric pool. Equal source weights are a provisional assumption while live samples accumulate.
 return {...input,rates:input.rates.map((rate,i)=>clamp(Math.sqrt(rate*market.rates[i]),.05,6)),
  market:true,marketDataSha256:market.sha256??null};
}
export async function sha256(text) {
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function seedMaterial(rows,input,fixture,archiveSha=null) {
 const digest=await sha256(JSON.stringify([VERSION,fixture,input,archiveSha,rows.map(({day,home,away,h,a})=>[day,home,away,h,a])]));
 return {digest,seed:Number.parseInt(digest.slice(0,8),16)};
}
