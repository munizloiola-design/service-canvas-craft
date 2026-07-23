## Objetivo
Suavizar a transição entre a etapa 1 (escolher Cliente/Agência) e a etapa 2 (formulário) na tela de login, para maior imersão. Fluxo funcional permanece intacto.

## Mudanças em `src/routes/login.tsx`

1. Crossfade entre etapas
   - Estado `transitioning` local. Ao escolher Cliente/Agência: fade-out ~180ms, troca `step`, novo bloco entra com `animate-fade-in` + `animate-scale-in`.
   - `key={step}` no wrapper força replay das animações.

2. Cards Cliente/Agência
   - Entrada em cascata com `animate-fade-in` e `animationDelay` 0ms/80ms.
   - Hover: `transition-all duration-300`, `hover:scale-[1.02]`, `hover:shadow-lg`, borda `border-primary/60`, ícone `group-hover:scale-110`.
   - Clique: `active:scale-[0.98]` + leve pulso do ícone antes da troca.

3. Formulário (etapa 2)
   - Título, inputs e botão com `animate-fade-in` escalonado (0/80/160ms).
   - Botão "Voltar" com `transition-colors` e ícone deslizando à esquerda no hover.

4. Caixa e fundo
   - Card entra uma vez com `animate-scale-in` + `animate-fade-in`.
   - Com `background_image`: `backdrop-blur-sm` + `bg-background/85` no Card e `transition-opacity duration-500` na camada de fundo.

5. Acessibilidade
   - Classes envoltas em `motion-safe:` para respeitar `prefers-reduced-motion`.

## Escopo
- Apenas visual em `src/routes/login.tsx`.
- Sem novas dependências (keyframes `fade-in`/`scale-in` já existem).
- Sem mudanças em auth, papéis, branding, rotas ou schema.
