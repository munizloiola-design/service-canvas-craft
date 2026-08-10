import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin_master" | "admin" | "gerente" | "membro" | "cliente";

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
  isMaster: boolean;
  isManager: boolean;
  isClient: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Defer to avoid deadlock
        setTimeout(() => loadRoles(s.user.id), 0);
      } else if (event === "SIGNED_OUT") {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadRoles(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const onFocus = () => {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s?.user) loadRoles(s.user.id);
      });
    };
    window.addEventListener("focus", onFocus);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function loadRoles(uid: string, isRetry = false): Promise<void> {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) {
      const expired = /jwt|token|expired|401/i.test(`${error.message} ${error.code ?? ""}`);
      if (expired && !isRetry) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed.session?.user) {
          return loadRoles(refreshed.session.user.id, true);
        }
        // Sessão irrecuperável: encerra para o usuário logar de novo
        toast.error("Sua sessão expirou. Entre novamente.");
        await supabase.auth.signOut();
        setRoles([]);
        return;
      }
      console.error("[auth:loadRoles]", error);
      // Não rebaixar o usuário silenciosamente: mantém os papéis anteriores
      return;
    }
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }


  const signIn: AuthState["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthState["signUp"] = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (r: AppRole) => roles.includes(r);
  // "admin_master" foi removido — Administrador agora tem poder total.
  const isMaster = hasRole("admin") || hasRole("admin_master");
  const isManager = isMaster || hasRole("gerente");
  const isClient = hasRole("cliente");

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signIn, signUp, signOut, hasRole, isMaster, isManager, isClient }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
