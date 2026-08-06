import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  requesterName?: string
  ticketTitle?: string
  reviewNotes?: string
  brandName?: string
  brandLogoUrl?: string | null
}

const TicketRejectedEmail = ({
  requesterName, ticketTitle, reviewNotes, brandName, brandLogoUrl,
}: Props) => {
  const brand = brandName || 'Dig.Workflow'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Sua solicitação não foi aprovada{ticketTitle ? `: ${ticketTitle}` : ''}</Preview>
      <Body style={main}>
        <Container style={container}>
          {brandLogoUrl ? (
            <Section style={{ textAlign: 'center', marginBottom: 24 }}>
              <Img src={brandLogoUrl} alt={brand} height={40} style={{ margin: '0 auto' }} />
            </Section>
          ) : null}
          <Heading style={h1}>
            {requesterName ? `Olá, ${requesterName}` : 'Olá'}
          </Heading>
          <Text style={text}>
            Sua solicitação <strong>{ticketTitle || 'enviada à equipe'}</strong> não pôde ser aprovada neste momento.
          </Text>
          {reviewNotes ? (
            <Section style={noteBox}>
              <Text style={noteLabel}>Motivo</Text>
              <Text style={noteText}>{reviewNotes}</Text>
            </Section>
          ) : null}
          <Text style={text}>
            Se precisar, entre em contato para discutirmos os próximos passos.
          </Text>
          <Text style={footer}>Equipe {brand}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TicketRejectedEmail,
  subject: (d: Record<string, any>) =>
    `Sua solicitação não foi aprovada · ${d?.brandName || 'Dig.Workflow'}`,
  displayName: 'Ticket recusado',
  previewData: {
    requesterName: 'João',
    ticketTitle: 'Banner promocional',
    reviewNotes: 'Precisamos de mais informações sobre o público-alvo e o prazo desejado.',
    brandName: 'Dig.Workflow',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111111', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444444', lineHeight: '1.6', margin: '0 0 14px' }
const noteBox = {
  backgroundColor: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: '8px', padding: '14px 16px', margin: '18px 0',
}
const noteLabel = { fontSize: '12px', fontWeight: 700, color: '#991b1b', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const noteText = { fontSize: '14px', color: '#7f1d1d', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' as const }
const footer = { fontSize: '12px', color: '#888888', margin: '32px 0 0' }
