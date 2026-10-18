BEGIN;
SET search_path=wiki,public;
ALTER FUNCTION publish_revision(uuid,text) RENAME TO base_publish_revision;
REVOKE EXECUTE ON FUNCTION base_publish_revision(uuid,text) FROM peppy_app;
CREATE FUNCTION publish_revision(target uuid,reason_text text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=wiki,public AS $$
DECLARE existing uuid;
BEGIN
 PERFORM require_editor();
 PERFORM 1 FROM revision WHERE id=target FOR UPDATE;
 SELECT id INTO existing FROM publication WHERE revision_id=target;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 IF EXISTS(SELECT 1 FROM claim c LEFT JOIN actor a ON a.id=c.reviewed_by WHERE c.revision_id=target AND c.approved AND (a.id IS NULL OR a.disabled OR NOT a.is_human OR a.role NOT IN ('editor','admin'))) THEN RAISE EXCEPTION 'Claim approval is no longer authorized'; END IF;
 IF EXISTS(SELECT 1 FROM evidence_assessment e LEFT JOIN actor a ON a.id=e.reviewed_by WHERE e.revision_id=target AND e.reviewed_by IS NOT NULL AND (a.id IS NULL OR a.disabled OR NOT a.is_human OR a.role NOT IN ('editor','admin'))) THEN RAISE EXCEPTION 'Assessment approval is no longer authorized'; END IF;
 IF EXISTS(SELECT 1 FROM evidence_record e WHERE e.revision_id=target AND NOT EXISTS(SELECT 1 FROM claim_citation cc WHERE cc.claim_id=e.claim_id AND cc.observation_id=e.observation_id AND cc.relation='supports')) OR EXISTS(SELECT 1 FROM trial_record t WHERE t.revision_id=target AND NOT EXISTS(SELECT 1 FROM claim_citation cc WHERE cc.claim_id=t.claim_id AND cc.observation_id=t.observation_id AND cc.relation='supports')) THEN RAISE EXCEPTION 'Evidence and trial sources must remain linked to the approved claims'; END IF;
 RETURN base_publish_revision(target,reason_text);
END $$;
REVOKE EXECUTE ON FUNCTION publish_revision(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_revision(uuid,text) TO peppy_app;
CREATE OR REPLACE FUNCTION guard_public_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE pid uuid; row_data jsonb;
BEGIN
 row_data:=CASE WHEN TG_OP='INSERT' THEN to_jsonb(NEW) ELSE to_jsonb(OLD) END;
 pid:=CASE WHEN TG_TABLE_NAME='peptide' THEN (row_data->>'id')::uuid ELSE (row_data->>'peptide_id')::uuid END;
 IF EXISTS(SELECT 1 FROM publication WHERE peptide_id=pid) THEN RAISE EXCEPTION 'Published identity is immutable; identity corrections require a reviewed migration'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
COMMIT;
