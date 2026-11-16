const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'index.html'))?__dirname:path.join(__dirname,'..');
const dataDir=process.argv[2]||path.join(root,'forecast-research-data');
const src=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("$('go').addEventListener")[0];
const {archiveRows,cleanRows,csv,estimateGoals,eloRatings,scheduleStrength,adjustedCandidate,resultDistribution,RELEASE_MODELS,canonicalClubRows,ARCHIVE_MODEL,archiveModelRates,lowScoreFactor,boundedRho,compareDate}=new Function(src+'return {archiveRows,cleanRows,csv,estimateGoals,eloRatings,scheduleStrength,adjustedCandidate,resultDistribution,RELEASE_MODELS,canonicalClubRows,ARCHIVE_MODEL,archiveModelRates,lowScoreFactor,boundedRho,compareDate};')();
const feeds=['tr.1','en.1','es.1','de.1','it.1','fr.1'];
const years=['2016-17','2017-18','2018-19','2019-20','2020-21','2021-22','2022-23','2023-24','2024-25','2025-26','2026-27'];
const groups={independent:[],research:[],validation:[],recent:[]};
for(const code of feeds){
 const earlier=[];
 for(const season of years){
  const file=path.join(dataDir,season+'-'+code+'.json');
  if(!fs.existsSync(file)&&season!=='2026-27')continue;
  const rows=canonicalClubRows(season==='2026-27'?cleanRows(csv(fs.readFileSync(path.join(dataDir,code+'.csv'),'utf8')),'2026-11-15',true):archiveRows(fs.readFileSync(file,'utf8'),'2026-07-01',{includeFlatScores:true}).rows);
  if(season<'2018-19'){earlier.push(...rows);continue;}
  const kind=season<'2020-21'?'independent':season<'2025-26'?'research':season==='2025-26'?'validation':'recent';
  groups[kind].push({code,season,rows,history:earlier.slice()});
  earlier.push(...rows);
 }
}
const configs=[{name:'live',history:0,share:0,decay:0,rho:0}];
configs.push(ARCHIVE_MODEL);
function topAndP(h,a,rho){
 const dc=rho*h*a*Math.exp(-h-a), p=resultDistribution(h,a);
 p[0]+=dc;p[1]-=2*dc;p[2]+=dc;
 const res=[];
 const modH=Math.floor(h),modA=Math.floor(a);
 let ph=Math.exp(-h);
 for(let i=0;i<=Math.max(3,modH+2);i++){
  let pa=Math.exp(-a);
  if(i>=Math.max(0,modH-3)||i<2)for(let j=0;j<=Math.max(3,modA+2);j++){
   if(j>=Math.max(0,modA-3)||j<2){
    const factor=lowScoreFactor(i,j,h,a,rho);
    const pair=[i+'–'+j,ph*pa*factor];
    let t=res.findIndex(x=>pair[1]>x[1]);if(t<0)t=res.length;
    if(t<3){res.splice(t,0,pair);if(res.length>3)res.pop();}
   }
   pa*=a/(j+1);
  }
  ph*=h/(i+1);
 }
 return {p,top:res};
}
const empty=()=>({n:0,hits:0,exact:0,top3:0,logLoss:0,brier:0,scoreLoss:0});
function add(m,row,h,a,rho){
 rho=boundedRho(rho,h,a);
 const {p,top}=topAndP(h,a,rho);
 const H=+row.ft_home,A=+row.ft_away,actual=H>A?0:H===A?1:2,score=H+'–'+A;
 m.n++;m.hits+=+(p.indexOf(Math.max(...p))===actual);m.exact+=+(top[0][0]===score);m.top3+=+top.some(x=>x[0]===score);
 m.logLoss-=Math.log(p[actual]);m.brier+=p.reduce((s,x,i)=>s+(x-+(i===actual))**2,0);
 let exact=Math.exp(-h-a);
 for(let i=1;i<=H;i++)exact*=h/i;
 for(let i=1;i<=A;i++)exact*=a/i;
 exact*=lowScoreFactor(H,A,h,a,rho);
 m.scoreLoss-=Math.log(Math.max(1e-15,exact));
}
function evaluate(blocks,models){
 const m=models.map(empty);
 const leagues=Object.fromEntries(feeds.map(code=>[code,models.map(empty)]));
 for(const {code,season,rows,history} of blocks){
  const from=Number(season.slice(0,4));
  const levels=new Map([1,2].map(n=>[n,history.filter(r=>r.date>=String(from-n)+'-07-01').sort(compareDate)]));
  let start=0,current,elo,cache;
  for(let i=0;i<rows.length;i++){
   const row=rows[i];
   if(i&&row.date!==rows[i-1].date){start=i;current=null}
   if(!current){current=rows.slice(0,start);assert.ok(current.every(x=>x.date<row.date));elo=eloRatings(current);cache=new Map()}
   const base=estimateGoals(row.home,row.away,current,false);
   if(!base)continue;
   const h=elo.get(row.home)??1500,a=elo.get(row.away)??1500;
   if(!cache.has('current'))cache.set('current',scheduleStrength(current,0,row.date));
   const live=adjustedCandidate(base,h,a,RELEASE_MODELS.clubs,cache.get('current'),row.home,row.away,false);
   for(const [j,model] of models.entries()){
    const key=[model.history,model.decay].join('|');
    let rates=live;
    if(model.history){
     if(!cache.has(key))cache.set(key,scheduleStrength([...levels.get(model.history).filter(x=>x.date<row.date),...current],model.decay,row.date));
     const fit=cache.get(key);
     const archival=levels.get(model.history);
     const counts=[row.home,row.away].map(team=>archival.filter(x=>(x.home===team||x.away===team)&&x.date<row.date).length);
     if(Math.min(...counts)>=5)rates=archiveModelRates(base,h,a,fit,row.home,row.away,false)||live;
    }
    const rho=rates===live?0:model.rho;
    add(m[j],row,...rates,rho);add(leagues[code][j],row,...rates,rho);
   }
  }
 }
 return {metrics:m,leagues};
}
const raw=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,evaluate(v,configs)]));
console.log(JSON.stringify({configs,raw},null,2));
