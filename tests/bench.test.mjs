import assert from "node:assert/strict";
import test from "node:test";
import {resolveBench,validateBench} from "../server/bench.ts";
import {scoreTeam} from "../server/scoreTeam.ts";

const starters=[1,2,3,4,5,6,7,8,9,10,11,12];
const bench=[101,102,103,104,105];
const positions=[1,2,2,3,3,4,4,4,5,5,5,6];
function squad(){
  const athletes=new Map(starters.map((id,index)=>[id,{
    id,apelido:"Titular "+id,posicao_id:positions[index],preco:10,clube_id:id,status_id:7
  }]));
  bench.forEach((id,index)=>athletes.set(id,{
    id,apelido:"Reserva "+id,posicao_id:index+1,preco:9,clube_id:id,status_id:7
  }));
  return athletes;
}
function fixtures(clubs,finished=true){
  return new Map(clubs.map(([club,time])=>[club,{kickoff:time,finished}]));
}

test("banco exige cinco posições, preço máximo e atletas distintos",()=>{
  assert.equal(validateBench(starters,bench,squad()),null);
  assert.match(validateBench(starters,[101,102,103,104,9],squad()),/repetir/);
  const athletes=squad();
  athletes.get(102).preco=11;
  assert.match(validateBench(starters,bench,athletes),/custa mais/);
  athletes.get(102).preco=9;
  athletes.get(102).posicao_id=3;
  assert.match(validateBench(starters,bench,athletes),/posição/);
});

test("reserva substitui apenas ausência confirmada e pontuação positiva",()=>{
  const points=new Map([[102,{points:5,played:true}]]);
  assert.deepEqual(resolveBench(starters,2,bench,points,squad(),fixtures([[2,100]],false),false),[]);
  assert.deepEqual(resolveBench(starters,2,bench,points,squad(),fixtures([[2,100]],true),false),
    [{outId:2,inId:102,position:2,captain:true}]);
  points.set(2,{points:0,played:true});
  assert.deepEqual(resolveBench(starters,2,bench,points,squad(),fixtures([[2,100]],true),false),[]);
  points.set(2,{points:-2,played:false});
  points.set(102,{points:0,played:true});
  assert.deepEqual(resolveBench(starters,2,bench,points,squad(),fixtures([[2,100]],true),false),[]);
});

test("duas ausências na mesma posição seguem a ordem dos jogos",()=>{
  const points=new Map([[102,{points:4,played:true}]]);
  const result=resolveBench(starters,3,bench,points,squad(),fixtures([[2,100],[3,200]]),false);
  assert.deepEqual(result,[{outId:2,inId:102,position:2,captain:false}]);
});

test("jogos simultâneos priorizam o capitão e o banco não entra duas vezes",()=>{
  const points=new Map([[102,{points:4,played:true}]]);
  const result=resolveBench(starters,3,bench,points,squad(),fixtures([[2,100],[3,100]]),false);
  assert.deepEqual(result,[{outId:3,inId:102,position:2,captain:true}]);
});

test("pontuação soma o reserva e transfere a braçadeira quando o capitão não atua",()=>{
  const points=new Map(starters.filter(id=>id!==2).map(id=>[id,{points:1,played:true}]));
  points.set(102,{points:8,played:true});
  const context={rodada:30,currentRound:30,status:"parcial",source:"teste",updatedAt:"",
    points,fixtures:fixtures(starters.map(id=>[id,100]))};
  const result=scoreTeam(30,starters,2,context,bench,squad());
  assert.equal(result.base,19);
  assert.equal(result.captainBonus,4);
  assert.equal(result.total,23);
  assert.equal(result.captainId,102);
  assert.equal(result.coverage,12);
  assert.deepEqual(result.substitutions,[{outId:2,inId:102,position:2,captain:true}]);
});

test("capitão ausente perde bônus se o único reserva da posição já entrou",()=>{
  const points=new Map(starters.filter(id=>![2,3].includes(id)).map(id=>[id,{points:1,played:true}]));
  points.set(102,{points:8,played:true});
  const context={rodada:30,currentRound:30,status:"parcial",source:"teste",updatedAt:"",
    points,fixtures:fixtures([[2,100],[3,200],...starters.filter(id=>![2,3].includes(id)).map(id=>[id,100])])};
  const result=scoreTeam(30,starters,3,context,bench,squad());
  assert.equal(result.total,18);
  assert.equal(result.captainBonus,0);
  assert.equal(result.captainId,null);
  assert.deepEqual(result.substitutions,[{outId:2,inId:102,position:2,captain:false}]);
});
