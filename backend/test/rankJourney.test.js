const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

test('journey protects rank, requires authorization and persists independent missions and promotion snapshots', async () => {
  const dir=fs.mkdtempSync(path.join(__dirname,'rank-fixture-'));
  fs.mkdirSync(path.join(dir,'src','services'),{recursive:true}); fs.mkdirSync(path.join(dir,'src','routes'),{recursive:true}); fs.mkdirSync(path.join(dir,'data'));
  for(const [source,target] of [['../src/jsonStore.js','src/jsonStore.js'],['../src/services/rankService.js','src/services/rankService.js'],['../src/routes/rankRoutes.js','src/routes/rankRoutes.js'],['../src/rank-default.json','src/rank-default.json']]) fs.copyFileSync(path.join(__dirname,source),path.join(dir,target));
  const initial=[{player_id:1,name:'A',stats:{match:10},metadata:{note:'giữ nguyên'}},{player_id:2,name:'B',stats:{match:4}}];
  fs.writeFileSync(path.join(dir,'data','players.json'),JSON.stringify(initial));
  const store=require(path.join(dir,'src','jsonStore')); const service=require(path.join(dir,'src','services','rankService')); service.initialize();
  assert.deepEqual(store.readCollection('players.json'),initial.map((p)=>({...p,rank:'young_talent'})));
  assert.equal(service.getAll().players[0].stages.length,4);
  const app=express(); app.use(express.json()); app.use('/r',require(path.join(dir,'src','routes','rankRoutes')));
  const server=await new Promise((resolve)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}); const base=`http://127.0.0.1:${server.address().port}/r`;
  const old=process.env.RANK_ADMIN_KEY; process.env.RANK_ADMIN_KEY='test-secret';
  const req=(url,method,body,key='test-secret')=>fetch(base+url,{method,headers:{'Content-Type':'application/json',...(key ? {'X-Rank-Admin-Key':key} : {})},body:body===undefined?undefined:JSON.stringify(body)});
  try {
    let r=await req('/players/1/promotions','POST',{target:'professional'},'');assert.equal(r.status,403);
    r=await req('/players/1/promotions','POST',{target:'world_class'});assert.equal(r.status,400);
    r=await req('/players/2/promotions','POST',{target:'professional'});let noMissions=await r.json();assert.equal(r.status,200);assert.equal(noMissions.current.code,'professional');assert.deepEqual(noMissions.history[0].missions,[]);assert.equal(noMissions.stages[1].complete,false);
    r=await req('/players/2/promotions','POST',{target:'professional'});assert.equal(r.status,400);
    r=await req('/players/1/stages/missing/missions','PUT',{missions:[]});assert.equal(r.status,400);
    r=await req('/players/1/stages/professional/missions','PUT',{missions:[null]});assert.equal(r.status,400);
    r=await req('/players/1/stages/professional/missions','PUT',{missions:[{name:'Bad stat',type:'stat',stat:'toString',scope:'career',target:1}]});assert.equal(r.status,400);
    const missions=[{name:'Tham gia',description:'',type:'stat',stat:'match',scope:'stage',target:2},{name:'Xác nhận',description:'',type:'manual'}];
    r=await req('/players/1/stages/professional/missions','PUT',{missions});let view=await r.json();assert.equal(r.status,200);assert.equal(view.stages[1].missions[0].progress,0);
    assert.equal(service.getAll().players[1].stages[1].missions.length,0);
    const manual=view.stages[1].missions.find((m)=>m.type==='manual');
    r=await req(`/players/1/stages/professional/missions/${manual.id}/confirmation`,'PUT',{confirmed:true});assert.equal(r.status,200);
    let players=store.readCollection('players.json');players[0].stats.match=12;players[0].rank='legend';store.writeCollection('players.json',players);
    assert.equal(store.readCollection('players.json')[0].rank,'young_talent');
    assert.equal(service.getAll().players[0].stages[1].complete,true);
    assert.equal(service.getAll().players[0].current.code,'young_talent');
    const beforeFailedPromotion=fs.readFileSync(path.join(dir,'data','players.json'),'utf8');
    const rename=fs.renameSync; let injectFailure=true;
    fs.renameSync=function(source,destination) { if(injectFailure && destination===path.join(dir,'data','players.json')) { injectFailure=false; throw new Error('Simulated disk failure'); } return rename.apply(this,arguments); };
    try { assert.throws(()=>service.promote(1,'professional'),/Simulated disk failure/); } finally { fs.renameSync=rename; }
    assert.equal(fs.readFileSync(path.join(dir,'data','players.json'),'utf8'),beforeFailedPromotion);
    assert.equal(service.getAll().players[0].history.length,0);
    r=await req('/players/1/promotions','POST',{target:'professional'});view=await r.json();assert.equal(r.status,200);assert.equal(view.current.code,'professional');assert.equal(view.history.length,1);
    r=await req('/players/1/promotions','POST',{target:'professional'});assert.equal(r.status,400);assert.equal(service.getAll().players[0].history.length,1);
    r=await req('/players/1/stages/professional/missions','PUT',{missions:[]});assert.equal(r.status,400);
    assert.throws(()=>store.removeRecord('players.json',1,'player_id'),/Không thể xóa cầu thủ đã được trao bậc/);
    players=store.readCollection('players.json');players[0].stats.match=0;delete players[0].rank;store.writeCollection('players.json',players);
    view=service.getAll().players[0];assert.equal(view.current.code,'professional');assert.equal(view.stages[1].complete,true);assert.equal(view.history[0].missions[0].progress,2);
    r=await req('/players/1/stages/world_class/missions','PUT',{missions:[{name:'Chưa xác nhận',type:'manual'},{name:'Chỉ tiêu cao',type:'stat',stat:'match',scope:'career',target:99}]});assert.equal(r.status,200);
    r=await req('/players/1/promotions','POST',{target:'world_class'});view=await r.json();assert.equal(r.status,200);assert.equal(view.current.code,'world_class');assert.equal(view.history.length,2);assert.equal(view.history[0].missions[0].confirmed,false);assert.equal(view.history[0].missions[1].progress,0);assert.equal(view.stages[2].complete,false);assert.equal(view.stages[2].completed,0);
    players=store.readCollection('players.json');players[0].stats.match=200;store.writeCollection('players.json',players);
    service.initialize();view=service.getAll().players[0];assert.equal(view.current.code,'world_class');assert.equal(view.history.length,2);assert.equal(view.stages[2].missions[1].progress,0);assert.equal(view.stages[2].complete,false);
    assert.deepEqual(Object.keys(store.readCollection('players.json')[0]).sort(),['player_id','name','stats','metadata','rank'].sort());
    const beforeData=JSON.parse(fs.readFileSync(path.join(dir,'data','player-rank-data.json')));const beforePlayers=store.readCollection('players.json');
    fs.writeFileSync(path.join(dir,'data','player-rank-transaction.json'),JSON.stringify({beforeData,beforePlayers}));
    fs.writeFileSync(path.join(dir,'data','player-rank-data.json'),JSON.stringify({...beforeData,history:[]}));
    service.initialize();assert.equal(service.getAll().players[0].history.length,2);assert.equal(fs.existsSync(path.join(dir,'data','player-rank-transaction.json')),false);
  } finally { if(old===undefined) delete process.env.RANK_ADMIN_KEY; else process.env.RANK_ADMIN_KEY=old; await new Promise((resolve)=>server.close(resolve)); fs.rmSync(dir,{recursive:true,force:true}); }
});
