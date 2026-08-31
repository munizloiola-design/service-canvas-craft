/**
 * Utilitário de datas: colunas `date` do banco vêm como "YYYY-MM-DD".
 * `new Date("YYYY-MM-DD")` interpreta como meia-noite UTC, o que em fusos
 * negativos (ex.: UTC-3) exibe o dia anterior. Estas funções tratam a data
 * como local, sem conversão de fuso.
 */

/** Converte "YYYY-MM-DD" (ou ISO com hora) em Date local segura. */
export function parseLocalDate(value: string): Date {
  // Somente data (sem componente de hora): interpreta como meia-noite local.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  return new Date(value);
}

/** Formata uma data do banco como dd/mm/aaaa (pt-BR). Retorna "—" se vazia. */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return "—";
  return parseLocalDate(value).toLocaleDateString("pt-BR");
}
