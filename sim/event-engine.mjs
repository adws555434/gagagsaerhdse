import {BLOCK,TRIALS,dcFactor} from './super-lig-model.mjs';

const segments=[.88,.93,.98,1.02,1.07,1.12];
const ownRed=.72, opponentRed=1.20, redRate=.09;
const pursuit=[1.05,1.12], ahead=[.96,.92];
export const SIZE=24;
const slots=SIZE*SIZE;
export const AGREEMENT=.0005;
const draws=[.25,.5,.25];

function randomStream(seed,block) {
 let state=(seed^Math.imul(block+1,0x9e3779b9))>>>0;
 const mix=()=>{
  state=(state+0x9e3779b9)>>>0;
  let n=state;
  n=Math.imul(n^(n>>>16),0x21f0aaad);
  n=Math.imul(n^(n>>>15),0x735a2d97);
  return (n^(n>>>15))>>>0;
 };
 let a=mix(),b=mix(),c=mix(),d=mix();
 return ()=>{
  const r=Math.imul(b,5),value=Math.imul((r<<7)|(r>>>25),9)>>>0;
  const t=b<<9;
  c^=a;d^=b;b^=c;a^=d;c^=t;d=(d<<11)|(d>>>21);
  return (value+.5)/4294967296;
 };
}
function rates(input,i,j){
 return [input.rates[0]*(1+(i-1)*input.uncertainty[0]),input.rates[1]*(1+(j-1)*input.uncertainty[1])];
}
function dynamics(rh,ra,segment,difference,cards){
 const homeRed=cards&1,awayRed=cards&2;
 const stage=Number(segment>=3);
 const h=rh*segments[segment]*(difference<0?pursuit[stage]:difference>0?ahead[stage]:1)*
  (homeRed?ownRed:1)*(awayRed?opponentRed:1);
 const a=ra*segments[segment]*(difference>0?pursuit[stage]:difference<0?ahead[stage]:1)*
  (awayRed?ownRed:1)*(homeRed?opponentRed:1);
 const redHome=homeRed?0:redRate,redAway=awayRed?0:redRate;
 return [h,a,redHome,redAway];
}
function transitionTable(rh,ra){
 return segments.map((_,segment)=>{
  const values=new Float64Array(5*4*4);
  for(let diff=-2;diff<=2;diff++)for(let cards=0;cards<4;cards++){
   let cumul=0;
   const from=((diff+2)*4+cards)*4;
   for(const [i,r] of dynamics(rh,ra,segment,diff,cards).entries())values[from+i]=cumul+=r;
  }
  return values;
 });
}
function sampleTime(random,table){
 let minute=0,segment=0,h=0,a=0,cards=0;
 for(;;){
  const diff=Math.max(-2,Math.min(2,h-a));
  const from=((diff+2)*4+cards)*4;
  let hazard=-Math.log(random());
  let values=table[segment],total=values[from+3];
  let remaining=(segment+1)/6-minute;
  while(hazard>=remaining*total){
   hazard-=remaining*total;
   if(++segment===6)return h*SIZE+a;
   minute=segment/6;
   values=table[segment];
   total=values[from+3];
   remaining=(segment+1)/6-minute;
  }
  minute+=hazard/total;
  const pick=random()*total;
  if(pick<values[from])h++;
  else if(pick<values[from+1])a++;
  else if(pick<values[from+2])cards|=1;
  else cards|=2;
  if(h>=SIZE||a>=SIZE)return slots;
 }
}
export function simulateBlock(input,seed,block,count=BLOCK){
 const tables=draws.flatMap((_,i)=>draws.map((__,j)=>transitionTable(...rates(input,i,j))));
 const corrections=Float64Array.from({length:slots+1},(_,i)=>i===slots?1:
  dcFactor(Math.floor(i/SIZE),i%SIZE,...input.rates,input.rho));
 const bound=corrections.reduce((peak,n)=>Math.max(peak,n),1);
 const counts=new Uint32Array(slots+1),random=randomStream(seed,block);
 const choice=()=>{const p=random();return p<.25?0:p<.75?1:2;};
 let proposals=0;
 while(count>0){
  const result=sampleTime(random,tables[choice()*3+choice()]);
  proposals++;
  if(bound>1&&random()*bound>=corrections[result])continue;
  counts[result]++;
  count--;
 }
 return {counts,proposals};
}
export function addCounts(target,source){
 for(let i=0;i<target.length;i++)target[i]+=source[i];
}
export function summarize(counts){
 const outcomes=[0,0,0],top=[];
 let n=0;
 for(let i=0;i<slots;i++){
  const count=counts[i],home=Math.floor(i/SIZE),away=i%SIZE;
  n+=count;
  outcomes[home>away?0:home===away?1:2]+=count;
  if(count)top.push({home,away,count});
 }
 top.sort((a,b)=>b.count-a.count||a.home-b.home||a.away-b.away);
 return {n,outcomes,top:top.slice(0,3),overflow:counts[slots]};
}
export function emptyCounts(){return new Uint32Array(slots+1);}
export function runSerial(input,seed,count=TRIALS){
 const counts=emptyCounts();
 let proposals=0;
 for(let block=0,remaining=count;remaining>0;block++,remaining-=BLOCK){
  const chunk=simulateBlock(input,seed,block,Math.min(remaining,BLOCK));
  addCounts(counts,chunk.counts);proposals+=chunk.proposals;
 }
 return {counts,proposals};
}

// Uniformization computes each segment's continuous-time transition matrix action.
function exactComponent(rh,ra){
 let state=new Float64Array(slots*4);
 state[0]=1;
 const transitions=transitionTable(rh,ra);
 for(const table of transitions){
  let ceiling=0;
  for(let s=3;s<table.length;s+=4)ceiling=Math.max(ceiling,table[s]);
  const mean=ceiling/6;
  const result=new Float64Array(state.length);
  let coefficient=Math.exp(-mean), weight=coefficient;
  for(let i=0;i<state.length;i++)result[i]=state[i]*coefficient;
  for(let k=1;k<=40;k++){
   const next=new Float64Array(state.length);
   for(let h=0;h<SIZE;h++)for(let a=0;a<SIZE;a++)for(let cards=0;cards<4;cards++){
    const i=(h*SIZE+a)*4+cards,mass=state[i]/ceiling;
    if(!mass)continue;
    const from=((Math.max(-2,Math.min(2,h-a))+2)*4+cards)*4;
    const r1=table[from],r2=table[from+1],r3=table[from+2],total=table[from+3];
    next[i]+=mass*(ceiling-total);
    if(h+1<SIZE)next[i+SIZE*4]+=mass*r1;
    if(a+1<SIZE)next[i+4]+=mass*(r2-r1);
    if(!(cards&1))next[i+1]+=mass*(r3-r2);
    if(!(cards&2))next[i+2]+=mass*(total-r3);
   }
   state=next;
   coefficient*=mean/k;
   weight+=coefficient;
   for(let i=0;i<state.length;i++)result[i]+=state[i]*coefficient;
   if(k>mean&&1-weight<1e-14)break;
  }
  state=result;
 }
 return Float64Array.from({length:slots},(_,i)=>state[i*4]+state[i*4+1]+state[i*4+2]+state[i*4+3]);
}
export function analyticMatrix(input){
 const matrix=new Float64Array(slots);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  const component=exactComponent(...rates(input,i,j));
  for(let k=0;k<slots;k++)matrix[k]+=component[k]*draws[i]*draws[j];
 }
 const tail=1-matrix.reduce((a,b)=>a+b,0);
 for(let i=0;i<slots;i++)matrix[i]*=dcFactor(Math.floor(i/SIZE),i%SIZE,...input.rates,input.rho);
 const mass=matrix.reduce((a,b)=>a+b,0);
 return {matrix:matrix.map(p=>p/mass),tail};
}
export function verify(counts,input,expected=TRIALS,tolerance=AGREEMENT){
 const result=summarize(counts);
 if(result.n+result.overflow!==expected||!result.top.length)throw Error('Simülasyon kayıt sayısı hatalı.');
 const {matrix,tail}=analyticMatrix(input);
 const exact=summarize(matrix);
 const maxScore=Math.max(...matrix.map((p,i)=>Math.abs(p-counts[i]/expected)));
 const maxOutcome=Math.max(...exact.outcomes.map((p,i)=>Math.abs(p-result.outcomes[i]/expected)));
 if(result.overflow||Math.max(maxOutcome,maxScore,tail)>tolerance){
  throw Error('Simülasyon analitik skor denetiminden geçmedi.');
 }
 return {...result,n:expected,maxScore,maxOutcome,tail};
}
