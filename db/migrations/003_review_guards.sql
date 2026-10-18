BEGIN;
SET search_path=wiki,public;
CREATE OR REPLACE FUNCTION guard_editor_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE reviewer uuid;
BEGIN
 IF TG_TABLE_NAME='evidence_assessment' THEN
  reviewer:=(to_jsonb(NEW)->>'reviewed_by')::uuid;
 ELSE
  reviewer:=(to_jsonb(NEW)->>'resolved_by')::uuid;
 END IF;
 IF reviewer IS NOT NULL THEN
  PERFORM require_editor();
  IF reviewer IS DISTINCT FROM current_actor() THEN RAISE EXCEPTION 'Reviewer identity mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION guard_public_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE pid uuid;
BEGIN
 pid:=CASE WHEN TG_TABLE_NAME='peptide' THEN (to_jsonb(OLD)->>'id')::uuid ELSE (to_jsonb(OLD)->>'peptide_id')::uuid END;
 IF EXISTS(SELECT 1 FROM active_publication WHERE peptide_id=pid) THEN RAISE EXCEPTION 'Withdraw public identity before changing identity metadata'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER published_identity_guard BEFORE UPDATE OR DELETE ON peptide FOR EACH ROW EXECUTE FUNCTION guard_public_identity();
CREATE TRIGGER published_alias_guard BEFORE UPDATE OR DELETE ON peptide_alias FOR EACH ROW EXECUTE FUNCTION guard_public_identity();
REVOKE EXECUTE ON FUNCTION guard_public_identity() FROM PUBLIC;
COMMIT;
