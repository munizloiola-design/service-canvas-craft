import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** A etapa é a de "Correção"? */
export function isCorrecaoStatus(name?: string | null) {
  return !!name && norm(name) === "correcao";
}

export type CorrectionTarget = { id: string; title: string; due_date: string | null };

/**
 * Pergunta se o usuário deseja alterar o prazo de entrega quando a demanda
 * entra na etapa de Correção.
 */
export function CorrectionDeadlineDialog({
  target,
  onClose,
  invalidateKeys = [["projects"]],
}: {
  target: CorrectionTarget | null;
  onClose: () => void;
  invalidateKeys?: string[][];
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(target?.due_date ?? "");
  }, [target]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({ due_date: date || null })
        .eq("id", target!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success("Prazo atualizado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Deseja alterar o prazo de entrega?</DialogTitle>
          <DialogDescription>
            A demanda "{target?.title}" entrou em Correção. Você pode definir um novo prazo agora.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-due">Novo prazo</Label>
          <Input id="new-due" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Manter prazo</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !date}>Salvar prazo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
