import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Deliverable = {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

/** Materiais para o cliente de uma demanda (vários arquivos). */
export function useDeliverables(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project_deliverables", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_deliverables")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Deliverable[];
    },
  });
}

/** Envia um arquivo de material e registra na lista da demanda. */
export async function uploadDeliverable(projectId: string, file: File, userId?: string | null) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/deliverable_${Date.now()}_${safe}`;
  const up = await supabase.storage.from("project-files").upload(path, file);
  if (up.error) throw up.error;
  const { error } = await supabase.from("project_deliverables").insert({
    project_id: projectId,
    file_name: file.name,
    file_path: path,
    file_size: file.size,
    mime_type: file.type || null,
    uploaded_by: userId ?? null,
  } as never);
  if (error) throw error;
  // mantém o campo legado apontando para o material mais recente
  await supabase.from("projects").update({ deliverable_path: path }).eq("id", projectId);
  return path;
}

/** Remove um material (arquivo + registro) e ajusta o campo legado. */
export async function deleteDeliverable(projectId: string, item: Deliverable) {
  await supabase.storage.from("project-files").remove([item.file_path]);
  const { error } = await supabase.from("project_deliverables").delete().eq("id", item.id);
  if (error) throw error;
  const { data } = await supabase
    .from("project_deliverables")
    .select("file_path")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);
  const next = (data?.[0] as { file_path: string } | undefined)?.file_path ?? null;
  await supabase.from("projects").update({ deliverable_path: next }).eq("id", projectId);
}

/** Abre um arquivo do bucket privado em nova aba. */
export async function openDeliverable(path: string) {
  const { data, error } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank");
}
