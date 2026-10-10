import {Component,type ErrorInfo,type ReactNode} from "react";
import {AlertTriangle,RotateCcw,House} from "lucide-react";
type Props={children:ReactNode};
type State={error:Error|null};
export default class AppErrorBoundary extends Component<Props,State>{
 state:State={error:null};
 static getDerivedStateFromError(error:Error):State{return {error};}
 componentDidCatch(error:Error,info:ErrorInfo){
  console.error("Cartola interface exception",error,info.componentStack);
 }
 reset=()=>this.setState({error:null});
 render(){
  if(!this.state.error)return this.props.children;
  return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-5">
   <section className="max-w-lg w-full bg-card border border-destructive/50 p-7 rounded-xl space-y-4">
    <AlertTriangle className="text-destructive h-9 w-9"/>
    <h1 className="text-xl font-black">Esta seção encontrou um erro</h1>
    <p className="text-sm text-muted-foreground">O aplicativo permanece disponível. Tente carregar novamente ou volte ao painel. Nenhuma escalação salva foi apagada.</p>
    <div className="flex flex-wrap gap-2">
      <button className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold px-4 py-3" onClick={()=>{this.reset();window.location.reload();}}><RotateCcw className="h-4 w-4"/> Recarregar</button>
      <a className="flex items-center gap-2 border border-border rounded-lg px-4 py-3" href="/dashboard"><House className="h-4 w-4"/> Ir ao painel</a>
    </div>
   </section>
  </main>;
 }
}
