BEGIN;
SET search_path=wiki,public;
CREATE OR REPLACE FUNCTION guard_revision_content() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE rid uuid; status_now editorial_status;
BEGIN
 IF TG_OP='UPDATE' AND NEW.revision_id<>OLD.revision_id THEN RAISE EXCEPTION 'Cannot move content between revisions'; END IF;
 rid:=CASE WHEN TG_OP='DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
 SELECT status INTO status_now FROM revision WHERE id=rid FOR UPDATE;
 IF status_now IN ('approved','published','archived') THEN RAISE EXCEPTION 'Revision is frozen; create a new revision'; END IF;
 UPDATE revision SET updated_at=clock_timestamp() WHERE id=rid;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
COMMIT;
