import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

export type MultiOption = { value: string; label: string };

/** Filtro com múltipla escolha (ex.: Etapa = Atendimento + Revisão). */
export function MultiSelectFilter({
  options,
  values,
  onChange,
  placeholder = "Selecionar...",
  className = "h-7 text-xs w-44",
  align = "start",
}: {
  options: MultiOption[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const selected = options.filter((o) => values.includes(o.value));
  const label =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((o) => o.label).join(", ")
        : `${selected.length} selecionados`;

  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...values, value] : values.filter((v) => v !== value));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`justify-between gap-2 font-normal ${className}`}
        >
          <span className={`truncate ${selected.length ? "" : "text-muted-foreground"}`}>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-60 p-2">
        <div className="max-h-64 overflow-y-auto space-y-1">
          {options.length === 0 && <p className="text-xs text-muted-foreground px-1 py-2">Nenhuma opção</p>}
          {options.map((o) => {
            const checked = values.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 cursor-pointer"
              >
                <Checkbox checked={checked} onCheckedChange={(v) => toggle(o.value, v === true)} />
                <span className="truncate">{o.label}</span>
              </label>
            );
          })}
        </div>
        {values.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs mt-1" onClick={() => onChange([])}>
            Limpar seleção
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
