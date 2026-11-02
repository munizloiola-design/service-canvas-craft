import { supabase } from "@/integrations/supabase/client";

export type DuplicateOptions = { copyAssignees: boolean; copyAttachments: boolean };

/** Duplicates a demand: content is copied; phase resets to the first stage, dates/deliverables/history start empty. */
export async function duplicateProject(sourceId: string, userId: string, opts: DuplicateOptions): Promise<string> {
  const { data: src, error } = await supabase.from("projects").select("*").eq("id", sourceId).single();
  if (error || !src) throw error ?? new Error("Demanda não encontrada");

  const { data: first } = await supabase.from("workflow_statuses").select("id").order("sort_order").limit(1).maybeSingle();

  const { data: created, error: insErr } = await supabase.from("projects").insert({
    title: `Cópia de ${src.title}`,
    description: src.description,
    description_cards: src.description_cards,
    caption: src.caption,
    client_id: src.client_id,
    client_name: src.client_name,
    team_id: src.team_id,
    media_type_id: src.media_type_id,
    media_type: src.media_type,
    service_type: src.service_type,
    reference_links: src.reference_links ?? [],
    has_reference: src.has_reference,
    notes: src.notes,
    priority: src.priority,
    priority_id: src.priority_id,
    budget: src.budget,
    status_id: first?.id ?? src.status_id,
    status: "a_fazer",
    created_by: userId,
    assigned_to: opts.copyAssignees ? src.assigned_to : null,
  }).select("id").single();
  if (insErr || !created) throw insErr ?? new Error("Falha ao duplicar");
  const newId = created.id;

  const { data: media } = await supabase.from("project_media_types").select("media_type_id").eq("project_id", sourceId);
  if (media?.length) {
    await supabase.from("project_media_types").insert(media.map((m) => ({ project_id: newId, media_type_id: m.media_type_id })));
  }

  if (opts.copyAssignees) {
    const { data: ass } = await supabase.from("project_assignees").select("user_id, role_id").eq("project_id", sourceId);
    if (ass?.length) {
      await supabase.from("project_assignees").insert(ass.map((a) => ({ project_id: newId, user_id: a.user_id, role_id: a.role_id })));
    }
  }

  if (opts.copyAttachments) {
    const { data: atts } = await supabase.from("project_attachments").select("*").eq("project_id", sourceId);
    for (const a of atts ?? []) {
      const name = a.file_path.split("/").pop() ?? a.file_name;
      const path = `${newId}/${Date.now()}_${name}`;
      const cp = await supabase.storage.from("project-files").copy(a.file_path, path);
      if (cp.error) continue;
      await supabase.from("project_attachments").insert({
        project_id: newId, file_name: a.file_name, file_path: path,
        file_size: a.file_size, mime_type: a.mime_type, uploaded_by: userId,
      });
    }
  }
  return newId;
}
