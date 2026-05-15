import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) || '' }),
})

function UnsubscribePage() {
  const { token } = Route.useSearch()
  const [state, setState] = useState<'loading' | 'ready' | 'already' | 'invalid' | 'done' | 'submitting' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) { setState('invalid'); return }
        if (j.valid) setState('ready')
        else if (j.reason === 'already_unsubscribed') setState('already')
        else setState('invalid')
      })
      .catch(() => setState('invalid'))
  }, [token])

  const confirm = async () => {
    setState('submitting')
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Falha')
      setState('done')
    } catch (e: any) {
      setError(e.message || 'Erro inesperado')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-6">
      <Card className="max-w-md w-full p-8 text-center">
        {state === 'loading' && <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />}
        {state === 'invalid' && (
          <>
            <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
            <h1 className="text-xl font-semibold">Link inválido</h1>
            <p className="text-sm text-muted-foreground mt-2">Este link de cancelamento não é válido ou expirou.</p>
          </>
        )}
        {state === 'already' && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-success mb-3" />
            <h1 className="text-xl font-semibold">Já cancelado</h1>
            <p className="text-sm text-muted-foreground mt-2">Você já cancelou o recebimento dos nossos e-mails.</p>
          </>
        )}
        {(state === 'ready' || state === 'submitting') && (
          <>
            <h1 className="text-xl font-semibold">Cancelar inscrição</h1>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Confirme para não receber mais e-mails deste remetente.
            </p>
            <Button onClick={confirm} disabled={state === 'submitting'} className="w-full">
              {state === 'submitting' ? 'Processando...' : 'Confirmar cancelamento'}
            </Button>
          </>
        )}
        {state === 'done' && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-success mb-3" />
            <h1 className="text-xl font-semibold">Pronto!</h1>
            <p className="text-sm text-muted-foreground mt-2">Você não receberá mais e-mails deste remetente.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
            <h1 className="text-xl font-semibold">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button onClick={confirm} variant="outline" className="mt-4">Tentar novamente</Button>
          </>
        )}
      </Card>
    </div>
  )
}
