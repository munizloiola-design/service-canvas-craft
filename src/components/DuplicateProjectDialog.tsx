import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { duplicateProject } from "@/lib/duplicate-project";
import { useAuth } from "@/hooks/useAuth";

export function DuplicateProjectDialog({ project, onClose, onDone }: {
  project: { id: string; title: string } | null;
  onClose: () => void;
  onDone: (newId: string) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [copyAssignees, setCopyAssignees] = useState(true);
  const [copyAttachments, setCopyAttachments] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!project || !user) return;
    setBusy(true);
    try {
      const id = await duplicateProject(project.id, user.id, { copyAssignees, copyAttachments });
      await Promise.all(["projects", "project_assignees", "project_media_types", "attachments"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success("Demanda duplicada");
      onClose();
      onDone(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Duplicar demanda</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Será criada "Cópia de {project?.title}" na primeira etapa, sem datas, entregas ou histórico.
        </p>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={copyAssignees} onCheckedChange={(v) => setCopyAssignees(!!v)} /> Copiar responsáveis</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={copyAttachments} onCheckedChange={(v) => setCopyAttachments(!!v)} /> Copiar anexos de referência</label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={run} disabled={busy}>{busy ? "Duplicando..." : "Duplicar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
