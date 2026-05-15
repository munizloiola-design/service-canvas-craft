import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  requesterName?: string
  ticketTitle?: string
  brandName?: string
  brandLogoUrl?: string | null
  primaryColor?: string
  trackUrl?: string | null
}

const TicketApprovedEmail = ({
  requesterName, ticketTitle, brandName, brandLogoUrl, primaryColor, trackUrl,
}: Props) => {
  const brand = brandName || 'Equipe.io'
  const color = primaryColor || '#3b82f6'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Sua solicitação foi aprovada{ticketTitle ? `: ${ticketTitle}` : ''}</Preview>
      <Body style={main}>
        <Container style={container}>
          {brandLogoUrl ? (
            <Section style={{ textAlign: 'center', marginBottom: 24 }}>
              <Img src={brandLogoUrl} alt={brand} height={40} style={{ margin: '0 auto' }} />
            </Section>
          ) : null}
          <Heading style={h1}>
            {requesterName ? `Olá, ${requesterName}!` : 'Olá!'}
          </Heading>
          <Text style={text}>
            Sua solicitação <strong>{ticketTitle || 'enviada à equipe'}</strong> foi <strong>aprovada</strong> e já entrou no nosso fluxo de produção.
          </Text>
          <Text style={text}>
            Em breve você receberá novidades sobre o andamento do trabalho.
          </Text>
          {trackUrl ? (
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={trackUrl} style={{ ...btn, backgroundColor: color }}>
                Acompanhar projeto
              </Button>
            </Section>
          ) : null}
          <Text style={footer}>Equipe {brand}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TicketApprovedEmail,
  subject: (d: Record<string, any>) =>
    `Sua solicitação foi aprovada · ${d?.brandName || 'Equipe.io'}`,
  displayName: 'Ticket aprovado',
  previewData: {
    requesterName: 'Maria',
    ticketTitle: 'Vídeo institucional',
    brandName: 'Equipe.io',
    primaryColor: '#3b82f6',
    trackUrl: 'https://example.com/v/abc',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111111', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444444', lineHeight: '1.6', margin: '0 0 14px' }
const btn = {
  color: '#ffffff', padding: '12px 24px', borderRadius: '8px',
  textDecoration: 'none', fontSize: '14px', fontWeight: 600,
}
const footer = { fontSize: '12px', color: '#888888', margin: '32px 0 0' }
