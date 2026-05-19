-- ============================================================
-- MIGRATION: Permissões anônimas para o Portal do Síndico
-- Permite que usuários com token (sem auth.uid) leiam dados
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- obs_projects: leitura para projetos com token ativo
DROP POLICY IF EXISTS "obs_projects_portal_anon" ON public.obs_projects;
CREATE POLICY "obs_projects_portal_anon" ON public.obs_projects
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.obs_portal_tokens WHERE project_id = obs_projects.id AND ativo = true)
  );

-- obs_clients: leitura para clientes vinculados a projetos com token ativo
DROP POLICY IF EXISTS "obs_clients_portal_anon" ON public.obs_clients;
CREATE POLICY "obs_clients_portal_anon" ON public.obs_clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.obs_projects p
      JOIN public.obs_portal_tokens t ON t.project_id = p.id
      WHERE p.client_id = obs_clients.id AND t.ativo = true
    )
  );

-- obs_project_stages: leitura de etapas
DROP POLICY IF EXISTS "obs_stages_portal_anon" ON public.obs_project_stages;
CREATE POLICY "obs_stages_portal_anon" ON public.obs_project_stages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.obs_portal_tokens WHERE project_id = obs_project_stages.project_id AND ativo = true)
  );

-- obs_diary: apenas RDOs finalizados (publicados)
DROP POLICY IF EXISTS "obs_diary_portal_anon" ON public.obs_diary;
CREATE POLICY "obs_diary_portal_anon" ON public.obs_diary
  FOR SELECT USING (
    finalizado = true AND
    EXISTS (SELECT 1 FROM public.obs_portal_tokens WHERE project_id = obs_diary.project_id AND ativo = true)
  );

-- obs_photos: fotos da obra
DROP POLICY IF EXISTS "obs_photos_portal_anon" ON public.obs_photos;
CREATE POLICY "obs_photos_portal_anon" ON public.obs_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.obs_portal_tokens WHERE project_id = obs_photos.project_id AND ativo = true)
  );

-- obs_documents: apenas documentos marcados como visíveis ao síndico
DROP POLICY IF EXISTS "obs_documents_portal_anon" ON public.obs_documents;
CREATE POLICY "obs_documents_portal_anon" ON public.obs_documents
  FOR SELECT USING (
    visivel_sindico = true AND
    EXISTS (SELECT 1 FROM public.obs_portal_tokens WHERE project_id = obs_documents.project_id AND ativo = true)
  );
