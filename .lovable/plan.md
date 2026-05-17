## Correção: Rules of Hooks em `src/routes/_app.tsx`

### Problema

No `AppLayout`, os hooks `useState(false)` para `mobileOpen` e o `useEffect` que fecha o menu mobile estão sendo chamados **depois** de três `return` condicionais (loading spinner, `<Navigate to="/login" />` e `<Navigate to="/portal/calendario" />`). Isso quebra as Rules of Hooks do React — a ordem dos hooks muda entre renders (ex.: quando `loading` passa de `true` para `false`), gerando o aviso/erro "React has detected a change in the order of Hooks" e podendo causar comportamento inconsistente do menu.

```tsx
if (loading || permsLoading) return <Spinner/>;
if (!user) return <Navigate .../>;
if (isClient) return <Navigate .../>;
...
const [mobileOpen, setMobileOpen] = useState(false);   // ❌ hook após early return
useEffect(() => { setMobileOpen(false); }, [pathname]); // ❌ hook após early return
```

### Solução

Mover **todos** os hooks (`useState`, `useEffect`) para o topo da função, antes de qualquer `return` condicional. Os cálculos derivados (`visibleGroups`, `initials`, `primaryRole`) podem permanecer depois dos early returns, pois não são hooks.

Estrutura final:

```tsx
function AppLayout() {
  // 1. Todos os hooks primeiro
  const { user, loading, signOut, roles, hasRole, isClient } = useAuth();
  const { branding } = useBranding();
  const { can, loading: permsLoading } = usePermissions();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // 2. Early returns
  if (loading || permsLoading) return <Spinner/>;
  if (!user) return <Navigate to="/login" />;
  if (isClient) return <Navigate to="/portal/calendario" />;

  // 3. Derivados e render
  const visibleGroups = ...;
  ...
}
```

Nenhuma outra alteração de comportamento, layout ou rotas.