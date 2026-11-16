import {SCOPE,VERSION,dayNumber,historyKey,historyRows,seedMaterial,trainChronologically,withMarket} from './super-lig-model.mjs';

export function parseArchive(text){
 const archive=JSON.parse(text);
 if(archive.version!==VERSION||!/^\d{4}-\d{2}-\d{2}$/.test(archive.cutoff)||
   !/^[a-f0-9]{64}$/.test(archive.archiveSha)||!Array.isArray(archive.state?.states)||
   !Array.isArray(archive.state?.counts)||!Array.isArray(archive.state?.errors)){
  throw Error('Geçmiş maç modeli doğrulanamadı.');
 }
 return archive;
}
export function buildInputs(results,cutoff,app,archive){
 const rows=historyRows(results.filter(row=>row.date>=archive.cutoff&&row.date<cutoff),app.clubModelKey);
 const model=trainChronologically(rows,undefined,archive.state);
 return async(fixture,quote)=>{
  const home=historyKey(fixture.home,app.clubModelKey),away=historyKey(fixture.away,app.clubModelKey);
  const base=model.current(home,away,dayNumber(fixture.date));
  if(!base)return null;
  const market=quote?.over25==null?null:app.marketTotalsDistribution(quote.power,quote.over25);
  const input=withMarket(base,market?{rates:[market.expectedHome,market.expectedAway],sha256:quote.dataSha256}:null);
  return {input,...await seedMaterial(rows,input,[SCOPE,fixture.date,fixture.time??null,home,away],archive.archiveSha)};
 };
}
