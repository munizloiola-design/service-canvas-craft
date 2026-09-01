/**
 * Régua de prioridade automática pela data de referência (postagem quando
 * existir; senão, o prazo de entrega):
 *  - até 1 dia (ou vencida) → Urgente
 *  - 2 a 5 dias             → Alta
 *  - 6 a 10 dias            → Média
 *  - acima de 10 dias       → Baixa
 */
import { parseLocalDate } from "@/lib/dates";

export type PriorityOption = { id: string; name: string; level?: number | null };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Nome da prioridade sugerida para uma data (ou null se não houver data). */
export function suggestPriorityName(dateISO?: string | null): string | null {
  if (!dateISO) return null;
  const target = parseLocalDate(dateISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days <= 1) return "urgente";
  if (days <= 5) return "alta";
  if (days <= 10) return "media";
  return "baixa";
}

/** Id da prioridade sugerida a partir das datas da demanda. */
export function suggestPriorityId(
  priorities: PriorityOption[],
  postDate?: string | null,
  dueDate?: string | null,
): string | null {
  const name = suggestPriorityName(postDate || dueDate);
  if (!name) return null;
  return priorities.find((p) => norm(p.name) === name)?.id ?? null;
}

/** Rótulo amigável da sugestão, para o aviso no formulário. */
export function suggestionLabel(
  priorities: PriorityOption[],
  postDate?: string | null,
  dueDate?: string | null,
): string | null {
  const id = suggestPriorityId(priorities, postDate, dueDate);
  return priorities.find((p) => p.id === id)?.name ?? null;
}
