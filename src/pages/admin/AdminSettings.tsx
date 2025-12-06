import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { 
  Shield, 
  Database, 
  Clock,
  Info
} from "lucide-react";

const AdminSettings = () => {
  const { user, role } = useAuth();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neon-cyan">Configurações</h1>
          <p className="text-muted-foreground">
            Informações do sistema e configurações
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Sua Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <Badge className="bg-primary text-primary-foreground">
                    {role}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {user?.id}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Database className="h-5 w-5 text-neon-green" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Backend</p>
                  <Badge variant="secondary">Lovable Cloud</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">API</p>
                  <Badge variant="secondary">Cartola FC</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Autenticação</p>
                  <Badge className="bg-success text-foreground">Ativo</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border md:col-span-2">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Info className="h-5 w-5 text-neon-yellow" />
                Sobre o Painel Admin
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Funcionalidades disponíveis neste painel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Analytics</h4>
                  <p className="text-sm text-muted-foreground">
                    Visualize estatísticas de sincronização, quantidade de jogadores
                    e histórico de operações.
                  </p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">
                    Gestão de Usuários
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Gerencie usuários, altere roles e ative/desative contas.
                  </p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">
                    Sincronização
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Sincronize dados da API do Cartola FC manualmente quando
                    necessário.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
