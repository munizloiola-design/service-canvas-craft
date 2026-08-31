import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Row = { project_id: string; media_type_id: string };

/** Mapa projeto -> lista de tipos de mídia (uma demanda pode ter vários). */
export function useProjectMediaTypes() {
  const { data = [] } = useQuery({
    queryKey: ["project_media_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("project_media_types" as any)
        .select("project_id, media_type_id");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of data) {
      if (!map.has(r.project_id)) map.set(r.project_id, []);
      map.get(r.project_id)!.push(r.media_type_id);
    }
    return map;
  }, [data]);
}

/** Tipos de mídia de uma demanda, com fallback para o campo antigo. */
export function mediaIdsOf(
  map: Map<string, string[]>,
  project: { id: string; media_type_id?: string | null },
): string[] {
  const list = map.get(project.id);
  if (list && list.length) return list;
  return project.media_type_id ? [project.media_type_id] : [];
}

/** Regrava os tipos de mídia da demanda. */
export async function syncProjectMediaTypes(projectId: string, mediaTypeIds: string[]) {
  const { error: delErr } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("project_media_types" as any)
    .delete()
    .eq("project_id", projectId);
  if (delErr) throw delErr;
  const unique = [...new Set(mediaTypeIds.filter(Boolean))];
  if (!unique.length) return;
  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("project_media_types" as any)
    .insert(unique.map((id) => ({ project_id: projectId, media_type_id: id })) as any);
  if (error) throw error;
}
