import assert from "node:assert/strict";
import test from "node:test";
import {optimize} from "../server/recommendation.ts";

const positions=[1,2,2,3,3,4,4,4,5,5,5,6];
const candidates=positions.map((pos,index)=>({
  id:index+1,apelido:`Atleta ${index+1}`,nome:`Atleta ${index+1}`,
  clube_id:index<5?1:index<8?2:index<10?3:4,
  posicao_id:pos,preco:5,media:8,jogos:20,status_id:7,
  variacao_preco:0,foto_url:null,predictedScore:index===10?18:8,
  volatility:0.5,objective:index===10?18:8,opponent:null,home:null,
  sample:5,reason:"",confidence:"alta",
}));

test("permite cinco atletas do mesmo clube e inclui o capitão no total",()=>{
  const pool=[...candidates,{...candidates[1],id:90,clube_id:5,objective:2,predictedScore:2}];
  const result=optimize(pool,100);
  assert.equal(result.players.length,12);
  assert.equal(result.players.filter(p=>p.clube_id===1).length,5);
  assert.equal(result.captainId,11);
  assert.equal(result.projectedPoints,12*8+10+9);
  assert.equal(result.reserves.length,5);
  assert.ok(result.capital<=100);
});

test("nunca seleciona jogador suspenso e recusa orçamento insuficiente",()=>{
  const pool=[...candidates,{...candidates[0],id:91,preco:1,objective:40,status_id:5}];
  assert.ok(!optimize(pool,100).players.some(p=>p.id===91));
  assert.throws(()=>optimize(pool,35),/Patrimônio insuficiente/);
});
