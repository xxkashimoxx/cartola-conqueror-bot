import cartolaHandler from "./cartola.js";
export default async function handler(req:any,res:any) {
  if(req.method!=="GET")return res.status(405).json({error:"GET obrigatório"});
  if(!process.env.CRON_SECRET || req.headers.authorization!=="Bearer "+process.env.CRON_SECRET)
    return res.status(401).json({error:"Não autorizado"});
  const task=String(req.query?.task||"full");
  if(!["full","partial"].includes(task))return res.status(400).json({error:"Tarefa inválida"});
  req.method="POST";
  req.query={name:task==="full"?"sync-cartola-data":"sync-parciais"};
  req.body={};
  return cartolaHandler(req,res);
}