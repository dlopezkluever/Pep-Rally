BEGIN;
SET search_path=wiki,public;
CREATE OR REPLACE FUNCTION guard_public_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE pid uuid; row_data jsonb;
BEGIN
 row_data:=CASE WHEN TG_OP='INSERT' THEN to_jsonb(NEW) ELSE to_jsonb(OLD) END;
 pid:=CASE WHEN TG_TABLE_NAME='peptide' THEN (row_data->>'id')::uuid ELSE (row_data->>'peptide_id')::uuid END;
 IF EXISTS(SELECT 1 FROM active_publication WHERE peptide_id=pid) THEN RAISE EXCEPTION 'Withdraw public identity before changing identity metadata'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER public_alias_insert_guard BEFORE INSERT ON peptide_alias FOR EACH ROW EXECUTE FUNCTION guard_public_identity();
CREATE TRIGGER public_identifier_guard BEFORE INSERT OR UPDATE OR DELETE ON peptide_identifier FOR EACH ROW EXECUTE FUNCTION guard_public_identity();
CREATE TRIGGER immutable_trial_identity BEFORE UPDATE OR DELETE ON clinical_trial FOR EACH ROW EXECUTE FUNCTION immutable_row();
CREATE FUNCTION guard_study() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE rid uuid;
BEGIN
 FOR rid IN SELECT e.revision_id FROM evidence_record e WHERE e.study_id=OLD.id ORDER BY e.revision_id LOOP
  PERFORM 1 FROM revision WHERE id=rid FOR UPDATE;
  IF EXISTS(SELECT 1 FROM revision WHERE id=rid AND status IN ('approved','published','archived')) THEN RAISE EXCEPTION 'Study used by frozen revision; add a corrected study version'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $$;
CREATE TRIGGER study_snapshot_guard BEFORE UPDATE OR DELETE ON study FOR EACH ROW EXECUTE FUNCTION guard_study();
CREATE FUNCTION guard_evidence_source() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM claim_citation WHERE claim_id=NEW.claim_id AND observation_id=NEW.observation_id AND relation='supports') THEN RAISE EXCEPTION 'Evidence observation must support its claim'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_source_guard BEFORE INSERT OR UPDATE ON evidence_record FOR EACH ROW EXECUTE FUNCTION guard_evidence_source();
CREATE TRIGGER trial_source_guard BEFORE INSERT OR UPDATE ON trial_record FOR EACH ROW EXECUTE FUNCTION guard_evidence_source();
ALTER FUNCTION article_data(uuid,boolean) RENAME TO base_article_data;
REVOKE EXECUTE ON FUNCTION base_article_data(uuid,boolean) FROM peppy_app;
CREATE FUNCTION article_data(target uuid,preview boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
DECLARE article jsonb; rid uuid;
BEGIN
 article:=base_article_data(target,preview);
 IF article IS NULL THEN RETURN NULL; END IF;
 rid:=(article->>'revisionId')::uuid;
 RETURN article || jsonb_build_object('related',coalesce((SELECT jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.canonical_name,'type',pr.relation_type)) FROM peptide_relation pr JOIN peptide p ON p.id=pr.related_peptide_id JOIN active_publication a ON a.peptide_id=p.id WHERE pr.revision_id=rid),'[]'));
END $$;
REVOKE EXECUTE ON FUNCTION article_data(uuid,boolean),guard_study(),guard_evidence_source() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION article_data(uuid,boolean) TO peppy_app;
COMMIT;
