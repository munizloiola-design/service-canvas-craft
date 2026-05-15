import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Facebook, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { getMetaConnection, saveMetaConnection, disconnectMeta, testMetaConnection } from "@/lib/facebook.functions";

export const Route = createFileRoute("/_app/integracoes")({ component: IntegrationsPage });

function IntegrationsPage() {
  const fetchConn = useServerFn(getMetaConnection);
  const saveFn = useServerFn(saveMetaConnection);
  const testFn = useServerFn(testMetaConnection);
  const disconnectFn = useServerFn(disconnectMeta);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["meta-conn"], queryFn: () => fetchConn() });

  const [token, setToken] = useState("");
  const [adAccount, setAdAccount] = useState("");
  const [pageId, setPageId] = useState("");
  const [testing, setTesting] = useState(false);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { access_token: token, ad_account_id: adAccount, page_id: pageId || null } }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success(`Conectado: ${r.name}`);
        setToken(""); setAdAccount(""); setPageId("");
        qc.invalidateQueries({ queryKey: ["meta-conn"] });
      } else toast.error(r.error);
    },
  });

  const disc = useMutation({
    mutationFn: () => disconnectFn({}),
    onSuccess: () => { toast.success("Desconectado"); qc.invalidateQueries({ queryKey: ["meta-conn"] }); },
  });

  async function handleTest() {
    if (!token || !adAccount) { toast.error("Preencha token e Ad Account"); return; }
    setTesting(true);
    const r: any = await testFn({ data: { access_token: token, ad_account_id: adAccount } });
    setTesting(false);
    r.ok ? toast.success(`Conta válida: ${r.name} (${r.currency})`) : toast.error(r.error);
  }

  const connected = !!data?.connection;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-sm text-muted-foreground">Conecte serviços externos à sua conta.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center">
                <Facebook className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Facebook Business</CardTitle>
                <CardDescription>Acompanhe campanhas e insights de anúncios</CardDescription>
              </div>
            </div>
            {connected ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Não conectado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : connected ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-1">
                <div><span className="text-muted-foreground">Conta:</span> <strong>{data!.connection!.display_name ?? "—"}</strong></div>
                <div><span className="text-muted-foreground">Ad Account:</span> {data!.connection!.ad_account_id}</div>
                {data!.connection!.page_id && <div><span className="text-muted-foreground">Página:</span> {data!.connection!.page_id}</div>}
                <div className="text-xs text-muted-foreground pt-1">Conectado em {new Date(data!.connection!.connected_at).toLocaleString("pt-BR")}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => disc.mutate()} disabled={disc.isPending}>
                Desconectar
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 text-sm space-y-2">
                <p className="font-medium">Como obter as credenciais:</p>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Acesse o <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">Business Settings <ExternalLink className="h-3 w-3" /></a></li>
                  <li>Crie um <strong>System User</strong> e gere um access token com permissão <code>ads_read</code></li>
                  <li>Copie o <strong>ID da conta de anúncios</strong> (formato <code>act_1234567890</code>)</li>
                </ol>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Access Token</Label>
                  <Input type="password" placeholder="EAAB..." value={token} onChange={(e) => setToken(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ad Account ID</Label>
                    <Input placeholder="act_1234567890" value={adAccount} onChange={(e) => setAdAccount(e.target.value)} />
                  </div>
                  <div>
                    <Label>Page ID (opcional)</Label>
                    <Input placeholder="1234567890" value={pageId} onChange={(e) => setPageId(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={handleTest} disabled={testing}>{testing ? "Testando…" : "Testar conexão"}</Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending || !token || !adAccount}>
                    {save.isPending ? "Salvando…" : "Conectar"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Em breve: Instagram, Google Ads, TikTok Ads.
      </p>
    </div>
  );
}
