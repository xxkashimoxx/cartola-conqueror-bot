import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
type AppUser={id:string;role:"admin"};
type AppContext={user:AppUser|null;session:{user:AppUser}|null;role:"admin"|null;isAdmin:boolean;publicAccess:boolean;loading:boolean;refresh:()=>Promise<boolean>;signOut:()=>Promise<void>};
const Context=createContext<AppContext|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<AppUser|null>(null),[loading,setLoading]=useState(true);
 const [publicAccess,setPublicAccess]=useState(false);
 const refresh=useCallback(async()=>{
  try{
   const r=await fetch("/api/access",{method:"GET",credentials:"same-origin",cache:"no-store"});
   const data=await r.json();
   const owner=r.ok&&data.authenticated?data.user:null;
   setPublicAccess(r.ok&&data.publicAccess===true);
   setUser(owner);return !!owner;
  }catch{setUser(null);setPublicAccess(false);return false;}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();const fn=()=>{void refresh()};window.addEventListener("cartola-auth-changed",fn);return()=>window.removeEventListener("cartola-auth-changed",fn)},[refresh]);
 const signOut=useCallback(async()=>{
  await fetch("/api/access",{method:"DELETE",credentials:"same-origin",headers:{"Content-Type":"application/json"}});
  setUser(null);
 },[]);
 const value=useMemo(()=>({user,session:user?{user}:null,role:user?"admin" as const:null,isAdmin:!!user,publicAccess,loading,refresh,signOut}),[user,publicAccess,loading,refresh,signOut]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth(){const x=useContext(Context);if(!x)throw Error("AuthProvider ausente");return x;}
