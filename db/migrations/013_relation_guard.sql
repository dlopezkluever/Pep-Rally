BEGIN;
SET search_path=wiki,public;
CREATE FUNCTION guard_relation_target() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM revision WHERE id=NEW.revision_id AND peptide_id=NEW.related_peptide_id) THEN
  RAISE EXCEPTION 'A peptide cannot be related to itself';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER relation_target_guard BEFORE INSERT OR UPDATE ON peptide_relation FOR EACH ROW EXECUTE FUNCTION guard_relation_target();
REVOKE EXECUTE ON FUNCTION guard_relation_target() FROM PUBLIC;
COMMIT;
