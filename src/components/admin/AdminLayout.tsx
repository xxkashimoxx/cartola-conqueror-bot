import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  Shield,
  Home,
  RefreshCw,
  Menu
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navItems = [
    { icon: BarChart3, label: "Analytics", path: "/admin" },
    { icon: RefreshCw, label: "Sincronização", path: "/admin/sync" },
    { icon: Settings, label: "Configurações", path: "/admin/settings" },
  ];

  const sidebar = (
    <>
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-neon-cyan">Admin Panel</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Acesso exclusivo do proprietário
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start gap-2 ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => { navigate("/dashboard"); setMenuOpen(false); }}
          >
            <Home className="h-4 w-4" />
            Voltar ao App
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
    </>
  );

  return (
    <div className="min-h-screen min-w-0 bg-background md:flex">
      <aside className="hidden md:flex md:w-64 md:shrink-0 bg-card border-r border-border flex-col">
        {sidebar}
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-72 flex-col bg-card p-0 md:hidden">
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="border-b border-border p-3 md:hidden">
          <Button type="button" variant="outline" onClick={() => setMenuOpen(true)} aria-label="Abrir menu administrativo">
            <Menu className="mr-2 h-4 w-4" /> Menu
          </Button>
        </div>
        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
