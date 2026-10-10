import {useEffect,useState,type FormEvent} from "react";
import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useAuth} from "@/hooks/useAuth";
import {LockKeyhole,Eye,EyeOff,ShieldCheck} from "lucide-react";
const Auth=()=>{
 const [password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[show,setShow]=useState(false);
 const {user,loading,refresh}=useAuth(),navigate=useNavigate();
 useEffect(()=>{if(!loading&&user)navigate("/dashboard",{replace:true})},[user,loading,navigate]);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{
   const r=await fetch("/api/access",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({password})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"Falha na autenticação");
   setPassword("");
   if(!await refresh())throw Error("Sessão não confirmada. Tente novamente.");
   navigate("/dashboard",{replace:true});
  }catch(e){setError(e instanceof Error?e.message:"Erro no login")}
  finally{setBusy(false)}
 }
 return <div className="min-h-screen bg-background flex items-center justify-center p-4">
  <div className="w-full max-w-md bg-card border-2 border-primary/70 rounded-xl p-7 md:p-9 shadow-neon">
   <div className="text-center mb-8">
    <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-xl bg-primary/15 border border-primary/40 mb-4"><ShieldCheck className="h-8 w-8 text-neon-cyan"/></div>
    <h1 className="text-3xl md:text-4xl font-black text-neon-cyan tracking-tight">Precisão &gt; Clubismo</h1>
    <p className="mt-3 text-muted-foreground">Acesso privado · Cartola Conqueror 2026</p>
   </div>
   <form onSubmit={submit} className="space-y-5">
    <div className="space-y-2">
     <Label htmlFor="owner-password" className="text-foreground font-bold">Senha de acesso</Label>
     <div className="relative">
      <Input autoFocus id="owner-password" type={show?"text":"password"} autoComplete="current-password" value={password} required minLength={6} maxLength={256}
       onChange={e=>setPassword(e.target.value)} placeholder="Digite sua senha" className="pr-12 h-12 bg-background"/>
      <button type="button" aria-label={show?"Ocultar senha":"Mostrar senha"} onClick={()=>setShow(!show)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
       {show?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}
      </button>
     </div>
    </div>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="w-full h-12 bg-primary font-bold text-primary-foreground" disabled={busy||loading} type="submit">
      <LockKeyhole className="mr-2 h-4 w-4"/>{busy?"Verificando...":"Entrar no painel"}
    </Button>
   </form>
   <p className="text-center text-xs text-muted-foreground mt-6">Login exclusivo · Sem cadastro público · Sessão protegida</p>
  </div>
 </div>
};
export default Auth;
