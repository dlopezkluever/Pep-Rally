BEGIN;
SET search_path=wiki,public;
CREATE TABLE retrieval_receipt (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid REFERENCES research_job,
 observation_id uuid REFERENCES source_observation,url text NOT NULL,
 retrieved_at timestamptz NOT NULL DEFAULT now(),status text NOT NULL,
 query text NOT NULL,adapter_version text NOT NULL,details jsonb NOT NULL DEFAULT '{}'
);
GRANT SELECT,INSERT ON retrieval_receipt TO peppy_app;
ALTER TABLE retrieval_receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY researcher_receipts ON retrieval_receipt FOR ALL TO peppy_app USING(has_role(ARRAY['researcher','editor','admin']::role_name[])) WITH CHECK(has_role(ARRAY['researcher','editor','admin']::role_name[]));
CREATE TRIGGER immutable_receipt BEFORE UPDATE OR DELETE ON retrieval_receipt FOR EACH ROW EXECUTE FUNCTION immutable_row();
ALTER TABLE claim ADD COLUMN extraction_id uuid REFERENCES extraction;
ALTER TABLE source_observation ADD COLUMN text_permission_basis text;

CREATE FUNCTION guard_assessment_link() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM evidence_record WHERE id=NEW.evidence_id AND revision_id=NEW.revision_id) THEN RAISE EXCEPTION 'Assessment evidence revision mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_link_guard BEFORE INSERT OR UPDATE ON assessment_evidence FOR EACH ROW EXECUTE FUNCTION guard_assessment_link();
CREATE FUNCTION guard_regulatory_source() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM claim_citation WHERE claim_id=NEW.claim_id AND observation_id=NEW.observation_id AND relation='supports') THEN RAISE EXCEPTION 'Regulatory source must support the regulatory claim'; END IF;
 IF NOT EXISTS(SELECT 1 FROM source_observation WHERE id=NEW.observation_id AND text_scope='regulatory' AND url ~ '^https://([a-z0-9-]+\.)*(fda\.gov|accessdata\.fda\.gov)/') THEN RAISE EXCEPTION 'US regulatory status requires an official FDA source'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER regulatory_source_guard BEFORE INSERT OR UPDATE ON regulatory_record FOR EACH ROW EXECUTE FUNCTION guard_regulatory_source();
REVOKE EXECUTE ON FUNCTION guard_assessment_link(),guard_regulatory_source() FROM PUBLIC;
COMMIT;
