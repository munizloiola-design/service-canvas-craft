import type { ComponentType } from 'react'
import { template as ticketApproved } from './ticket-approved'
import { template as ticketRejected } from './ticket-rejected'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'ticket-approved': ticketApproved,
  'ticket-rejected': ticketRejected,
}
