import {SCOPE,TRIALS,VERSION,historyKey} from './super-lig-model.mjs';

export function fixtureId(row,app){
 return [row.date,historyKey(row.home,app.clubModelKey),historyKey(row.away,app.clubModelKey)].join('|');
}
export function scoreLedger(rows){
 const totals={n:0,winner:0,score:0,top3:0};
 for(const row of rows){
  if(row.version!==VERSION||row.result.n!==TRIALS||!row.actual)continue;
  const [h,a]=row.actual;
  const pick=row.result.top[0];
  totals.n++;
  totals.winner+=Number(Math.sign(pick.home-pick.away)===Math.sign(h-a));
  totals.score+=Number(pick.home===h&&pick.away===a);
  totals.top3+=Number(row.result.top.some(p=>p.home===h&&p.away===a));
 }
 return totals;
}
export async function collectEventLedger({prior,results,fixtures,market,app,prepare,simulate,clock=Date.now,onRecord=()=>{}}){
 const resultById=new Map(results.filter(app.validScore).map(row=>[fixtureId(row,app),row]));
 const records=prior.map(row=>{
  const match=resultById.get(row.id);
  return match&&!row.actual&&clock()>row.kickoff
   ?{...row,actual:[Number(match.ft_home),Number(match.ft_away)]}:row;
 });
 if(records.some((record,i)=>record!==prior[i]))await onRecord(records);
 const keys=new Set(records.map(row=>row.id));
 const sorted=fixtures.map(fixture=>({fixture,kickoff:app.knownKickoff(fixture)})).sort((a,b)=>a.kickoff-b.kickoff);
 for(const {fixture,kickoff} of sorted){
  const now=clock(),id=fixtureId(fixture,app);
  if(!(kickoff>now&&kickoff-now<=48*3600000)||keys.has(id)||resultById.has(id))continue;
  const quote=market?.version===app.MARKET_VERSION?app.findMarketQuote(market,SCOPE,fixture,now):null;
  const prepared=await prepare(fixture,quote);
  if(!prepared)continue;
  const result=await simulate(prepared);
  if(result.n!==TRIALS||!result.top?.length)throw Error('Eksik simülasyon kaydı.');
  const savedAt=clock();
  if(savedAt>=kickoff)continue;
  const record={id,home:fixture.home,away:fixture.away,kickoff,savedAt,version:VERSION,
   dataSha256:prepared.digest,market:!!prepared.input.market,result,actual:null};
  records.push(record);
  keys.add(id);
  await onRecord(records);
 }
 return records;
}
