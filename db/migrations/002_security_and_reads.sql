BEGIN;
SET search_path=wiki,public;

CREATE FUNCTION auth_credentials(login_email text) RETURNS TABLE(id uuid,password_hash text,disabled boolean) LANGUAGE sql SECURITY DEFINER SET search_path=wiki,public AS $$
 SELECT id,password_hash,disabled FROM actor WHERE email=lower(login_email)
$$;
CREATE FUNCTION auth_session(token text) RETURNS TABLE(id uuid,email text,display_name text,role role_name,is_human boolean) LANGUAGE sql SECURITY DEFINER SET search_path=wiki,public AS $$
 SELECT a.id,a.email,a.display_name,a.role,a.is_human FROM session s JOIN actor a ON a.id=s.actor_id WHERE s.token_hash=token AND s.expires_at>now() AND NOT a.disabled
$$;
CREATE FUNCTION auth_create_session(target_actor uuid, token text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=wiki,public AS $$
 INSERT INTO session(token_hash,actor_id,expires_at) SELECT token,id,now()+interval '8 hours' FROM actor WHERE id=target_actor AND NOT disabled
$$;
CREATE FUNCTION auth_delete_session(token text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=wiki,public AS $$ DELETE FROM session WHERE token_hash=token $$;
CREATE FUNCTION log_action(action_text text,target uuid,reason_text text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=wiki,public AS $$
 INSERT INTO audit_event(actor_id,action,entity_id,reason) SELECT current_actor(),action_text,target,reason_text WHERE has_role(ARRAY['researcher','editor','admin']::role_name[])
$$;
CREATE FUNCTION withdraw_publication(target uuid,reason_text text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=wiki,public AS $$
BEGIN
 PERFORM require_editor();
 IF length(trim(reason_text))=0 THEN RAISE EXCEPTION 'Reason required'; END IF;
 PERFORM 1 FROM peptide WHERE id=target FOR UPDATE;
 DELETE FROM active_publication WHERE peptide_id=target;
 PERFORM log_action('withdraw',target,reason_text);
END $$;

CREATE FUNCTION guard_new_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
BEGIN
 IF NEW.status NOT IN ('unresearched','researching','draft') THEN RAISE EXCEPTION 'New revisions start unreviewed'; END IF;
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM revision WHERE id=NEW.parent_id AND peptide_id=NEW.peptide_id) THEN RAISE EXCEPTION 'Parent identity mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER revision_insert_guard BEFORE INSERT ON revision FOR EACH ROW EXECUTE FUNCTION guard_new_revision();
CREATE FUNCTION guard_editor_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
BEGIN
 IF TG_TABLE_NAME='evidence_assessment' AND NEW.reviewed_by IS NOT NULL THEN
  PERFORM require_editor();
  IF NEW.reviewed_by IS DISTINCT FROM current_actor() THEN RAISE EXCEPTION 'Assessment reviewer identity mismatch'; END IF;
 ELSIF TG_TABLE_NAME='claim_flag' AND NEW.resolved_by IS NOT NULL THEN
  PERFORM require_editor();
  IF NEW.resolved_by IS DISTINCT FROM current_actor() THEN RAISE EXCEPTION 'Resolution identity mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_editor_guard BEFORE INSERT OR UPDATE ON evidence_assessment FOR EACH ROW EXECUTE FUNCTION guard_editor_fields();
CREATE TRIGGER flag_editor_guard BEFORE INSERT OR UPDATE ON claim_flag FOR EACH ROW EXECUTE FUNCTION guard_editor_fields();

CREATE FUNCTION catalog_list(query_text text DEFAULT '',area_slug text DEFAULT '',family_slug text DEFAULT '',grade_text text DEFAULT '') RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
 SELECT coalesce(jsonb_agg(item ORDER BY name),'[]') FROM (
  SELECT p.canonical_name AS name,jsonb_build_object(
   'id',p.id,'slug',p.slug,'name',p.canonical_name,'revisionId',r.id,
   'summary',coalesce((SELECT plain_text FROM claim WHERE revision_id=r.id AND section='overview' ORDER BY sort_order LIMIT 1),(SELECT claim_text FROM claim WHERE revision_id=r.id AND section='overview' ORDER BY sort_order LIMIT 1),''),
   'reviewedAt',r.last_reviewed_at,'areas',coalesce((SELECT jsonb_agg(rt.label_snapshot) FROM revision_taxonomy rt JOIN taxonomy t ON t.id=rt.taxonomy_id WHERE rt.revision_id=r.id AND t.kind='area'),'[]'),
   'humanGrade',coalesce((SELECT grade::text FROM evidence_assessment WHERE revision_id=r.id AND dimension='human'),'Unknown'),
   'regulatory',coalesce((SELECT status FROM regulatory_record WHERE revision_id=r.id AND jurisdiction='United States' ORDER BY verified_at DESC LIMIT 1),'unclear')
  ) AS item FROM peptide p JOIN published_revision r ON r.peptide_id=p.id JOIN public_search s ON s.revision_id=r.id
  WHERE (query_text='' OR s.document @@ websearch_to_tsquery('english',query_text) OR p.canonical_name ILIKE '%'||query_text||'%' OR similarity(p.canonical_name,query_text)>0.2 OR regexp_replace(lower(p.canonical_name||s.aliases),'[^a-z0-9]','','g') LIKE '%'||regexp_replace(lower(query_text),'[^a-z0-9]','','g')||'%' OR EXISTS(SELECT 1 FROM peptide_alias WHERE peptide_id=p.id AND similarity(alias,query_text)>0.2))
  AND (area_slug='' OR EXISTS(SELECT 1 FROM revision_taxonomy rt JOIN taxonomy t ON t.id=rt.taxonomy_id WHERE rt.revision_id=r.id AND t.kind='area' AND t.slug=area_slug))
  AND (family_slug='' OR EXISTS(SELECT 1 FROM revision_taxonomy rt JOIN taxonomy t ON t.id=rt.taxonomy_id WHERE rt.revision_id=r.id AND t.kind='family' AND t.slug=family_slug))
  AND (grade_text='' OR EXISTS(SELECT 1 FROM evidence_assessment WHERE revision_id=r.id AND dimension='human' AND grade::text=grade_text))
  LIMIT 100
 ) results
$$;
CREATE FUNCTION article_data(target uuid,preview boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
DECLARE rid uuid; result jsonb;
BEGIN
 IF preview THEN
  IF NOT has_role(ARRAY['researcher','editor','admin']::role_name[]) THEN RAISE EXCEPTION 'Preview requires researcher'; END IF;
  rid:=target;
 ELSE
  SELECT r.id INTO rid FROM published_revision r WHERE r.peptide_id=target;
 END IF;
 IF rid IS NULL THEN RETURN NULL; END IF;
 SELECT jsonb_build_object(
  'id',p.id,'slug',p.slug,'name',p.canonical_name,'revisionId',r.id,'status',r.status,
  'reviewedAt',r.last_reviewed_at,'updatedAt',r.updated_at,'nextReviewDue',r.next_review_due,
  'aliases',coalesce((SELECT jsonb_agg(alias ORDER BY alias) FROM peptide_alias WHERE peptide_id=p.id),'[]'),
  'claims',coalesce((SELECT jsonb_agg(to_jsonb(c) || jsonb_build_object('citations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'url',o.url,'authors',o.authors,'publication',o.publication,'date',o.publication_date,'retrievedAt',o.retrieved_at,'scope',o.text_scope,'locator',cc.locator,'relation',cc.relation)) FROM claim_citation cc JOIN source_observation o ON o.id=cc.observation_id WHERE cc.claim_id=c.id),'[]')) ORDER BY c.sort_order,c.id) FROM claim c WHERE revision_id=r.id),'[]'),
  'assessments',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM evidence_assessment e WHERE revision_id=r.id),'[]'),
  'trials',coalesce((SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('registry_id',ct.registry_id)) FROM trial_record t JOIN clinical_trial ct ON ct.id=t.trial_id WHERE revision_id=r.id),'[]'),
  'regulations',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM regulatory_record g WHERE revision_id=r.id),'[]'),
  'safety',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM safety_record s WHERE revision_id=r.id),'[]'),
  'flags',CASE WHEN preview THEN coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM claim_flag f WHERE revision_id=r.id),'[]') ELSE '[]'::jsonb END,
  'humanStudyCount',(SELECT count(DISTINCT study_id) FROM evidence_record WHERE revision_id=r.id AND evidence_type IN ('case_report','observational','pilot_human','clinical_trial','randomized_controlled_trial')),
  'trialCount',(SELECT count(*) FROM trial_record WHERE revision_id=r.id)
 ) INTO result FROM revision r JOIN peptide p ON p.id=r.peptide_id WHERE r.id=rid;
 RETURN result;
END $$;
CREATE FUNCTION resolve_peptide(target_slug text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
 SELECT p.id FROM peptide p JOIN active_publication a ON a.peptide_id=p.id WHERE p.slug=target_slug
$$;
CREATE FUNCTION public_taxonomy() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('slug',slug,'label',label,'kind',kind) ORDER BY label),'[]') FROM taxonomy
$$;
CREATE FUNCTION public_history(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('date',p.published_at,'reason',p.reason) ORDER BY p.published_at DESC),'[]') FROM publication p JOIN active_publication a ON a.peptide_id=p.peptide_id WHERE p.peptide_id=target
$$;
GRANT EXECUTE ON FUNCTION auth_credentials(text),auth_session(text),auth_create_session(uuid,text),auth_delete_session(text),log_action(text,uuid,text),withdraw_publication(uuid,text),catalog_list(text,text,text,text),article_data(uuid,boolean),resolve_peptide(text),public_taxonomy(),public_history(uuid) TO peppy_app;
REVOKE EXECUTE ON FUNCTION auth_credentials(text),auth_session(text),auth_create_session(uuid,text),auth_delete_session(text),log_action(text,uuid,text),withdraw_publication(uuid,text),guard_new_revision(),guard_editor_fields(),catalog_list(text,text,text,text),article_data(uuid,boolean),resolve_peptide(text),public_taxonomy(),public_history(uuid) FROM PUBLIC;
COMMIT;
