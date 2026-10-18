BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA IF NOT EXISTS wiki;
SET search_path = wiki, public;

CREATE TYPE role_name AS ENUM ('viewer','researcher','editor','admin');
CREATE TYPE editorial_status AS ENUM ('unresearched','researching','draft','needs_review','approved','published','archived');
CREATE TYPE evidence_type AS ENUM ('in_vitro','animal','case_report','observational','pilot_human','clinical_trial','randomized_controlled_trial','systematic_review','meta_analysis','regulatory','unknown');
CREATE TYPE knowledge_state AS ENUM ('known','unknown','insufficient_evidence','conflicting_evidence','not_established');
CREATE TYPE evidence_grade AS ENUM ('Strong','Moderate','Limited','Very Limited','None Identified','Conflicting');

CREATE TABLE actor (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
 display_name text NOT NULL, password_hash text NOT NULL,
 role role_name NOT NULL DEFAULT 'viewer', is_human boolean NOT NULL DEFAULT true,
 disabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE session (
 token_hash text PRIMARY KEY, actor_id uuid NOT NULL REFERENCES actor,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE peptide (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 canonical_name text UNIQUE NOT NULL, short_name text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE peptide_identifier (
 peptide_id uuid NOT NULL REFERENCES peptide, namespace text NOT NULL,
 value text NOT NULL, PRIMARY KEY (namespace,value)
);
CREATE TABLE peptide_alias (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), peptide_id uuid NOT NULL REFERENCES peptide,
 alias text NOT NULL, alias_type text NOT NULL CHECK (alias_type IN ('scientific','commercial','research_code','abbreviation','legacy_name')),
 normalized text GENERATED ALWAYS AS (regexp_replace(lower(alias),'[^a-z0-9]','','g')) STORED,
 UNIQUE(peptide_id,alias)
);
CREATE INDEX alias_normalized ON peptide_alias(normalized);
CREATE INDEX alias_fuzzy ON peptide_alias USING gin(alias gin_trgm_ops);
CREATE TABLE taxonomy (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('area','family')),
 slug text NOT NULL, label text NOT NULL, UNIQUE(kind,slug)
);
CREATE TABLE revision (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), peptide_id uuid NOT NULL REFERENCES peptide,
 parent_id uuid REFERENCES revision, status editorial_status NOT NULL DEFAULT 'draft',
 created_by uuid REFERENCES actor, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), last_researched_at timestamptz,
 last_reviewed_at timestamptz, next_review_due date, review_reason text,
 UNIQUE(id,peptide_id)
);
CREATE TABLE peptide_profile (
 revision_id uuid PRIMARY KEY REFERENCES revision,
 peptide_type text, endogenous_status knowledge_state NOT NULL DEFAULT 'unknown',
 development_status text, sequence text, molecular_formula text,
 molecular_weight numeric CHECK(molecular_weight > 0), first_reported_date date,
 other_identifiers jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE source (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_type text NOT NULL,
 identity_key text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE source_identifier (
 source_id uuid NOT NULL REFERENCES source, namespace text NOT NULL,
 value text NOT NULL, PRIMARY KEY(namespace,value)
);
CREATE TABLE source_observation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES source,
 title text NOT NULL, authors text[] NOT NULL DEFAULT '{}', publication text,
 publication_date date, url text NOT NULL CHECK(url ~ '^https://'),
 retrieved_at timestamptz NOT NULL DEFAULT now(), content_hash text NOT NULL,
 text_scope text NOT NULL CHECK(text_scope IN ('metadata','abstract','full_text','registry','regulatory')),
 source_text text, source_quality text NOT NULL DEFAULT 'unassessed',
 license_note text NOT NULL, adapter_version text NOT NULL DEFAULT 'manual-v1',
 notes text, UNIQUE(source_id,content_hash)
);
CREATE TABLE study (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), identity_key text UNIQUE NOT NULL,
 study_design text, species text, population text, sample_size integer CHECK(sample_size > 0)
);
CREATE TABLE study_source (
 study_id uuid REFERENCES study, source_id uuid REFERENCES source,
 PRIMARY KEY(study_id,source_id)
);
CREATE TABLE claim (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revision,
 section text NOT NULL CHECK(section IN ('overview','mechanism','research_areas','human','animal','cell','trials','safety','unknowns','regulatory','timeline','related')),
 claim_text text NOT NULL CHECK(length(trim(claim_text)) > 0), plain_text text,
 claim_type text NOT NULL DEFAULT 'research_summary',
 assertion_scope text NOT NULL CHECK(assertion_scope IN ('cell','animal','human','clinical','regulatory','mixed','unknown')),
 evidence_type evidence_type NOT NULL DEFAULT 'unknown',
 knowledge_state knowledge_state NOT NULL DEFAULT 'unknown',
 evidence_strength evidence_grade, confidence text NOT NULL DEFAULT 'unassessed',
 limitations text NOT NULL DEFAULT 'Not assessed',
 origin text NOT NULL CHECK(origin IN ('human','ai','import')),
 approved boolean NOT NULL DEFAULT false, reviewed_by uuid REFERENCES actor, reviewed_at timestamptz,
 review_note text, sort_order integer NOT NULL DEFAULT 0,
 CHECK((approved AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR NOT approved),
 UNIQUE(id,revision_id)
);
CREATE TABLE claim_citation (
 claim_id uuid NOT NULL REFERENCES claim ON DELETE CASCADE,
 observation_id uuid NOT NULL REFERENCES source_observation,
 locator text NOT NULL CHECK(length(trim(locator)) > 0),
 relation text NOT NULL CHECK(relation IN ('supports','contradicts','context')),
 PRIMARY KEY(claim_id,observation_id,locator)
);
CREATE TABLE evidence_record (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revision,
 study_id uuid NOT NULL REFERENCES study, observation_id uuid NOT NULL REFERENCES source_observation,
 claim_id uuid NOT NULL, evidence_type evidence_type NOT NULL,
 title text NOT NULL, summary text NOT NULL, finding text NOT NULL,
 year integer CHECK(year BETWEEN 1800 AND 2200), confidence text NOT NULL,
 limitations text NOT NULL, editorial_status editorial_status NOT NULL DEFAULT 'draft',
 FOREIGN KEY(claim_id,revision_id) REFERENCES claim(id,revision_id), UNIQUE(revision_id,study_id,observation_id)
);
CREATE TABLE mechanism (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revision,
 claim_id uuid NOT NULL, target text, pathway text,
 confidence text NOT NULL CHECK(confidence IN ('established','supported_hypothesis','proposed','unknown')),
 FOREIGN KEY(claim_id,revision_id) REFERENCES claim(id,revision_id)
);
CREATE TABLE revision_taxonomy (
 revision_id uuid NOT NULL REFERENCES revision, taxonomy_id uuid NOT NULL REFERENCES taxonomy,
 claim_id uuid NOT NULL, label_snapshot text NOT NULL,
 PRIMARY KEY(revision_id,taxonomy_id), FOREIGN KEY(claim_id,revision_id) REFERENCES claim(id,revision_id)
);
CREATE TABLE clinical_trial (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registry text NOT NULL, registry_id text NOT NULL,
 UNIQUE(registry,registry_id), CHECK(registry <> 'ClinicalTrials.gov' OR registry_id ~ '^NCT[0-9]{8}$')
);
CREATE TABLE trial_record (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revision,
 trial_id uuid NOT NULL REFERENCES clinical_trial, claim_id uuid NOT NULL,
 observation_id uuid NOT NULL REFERENCES source_observation,
 title text NOT NULL, phase text, status text NOT NULL, enrollment integer CHECK(enrollment >= 0),
 enrollment_type text, population text, intervention text, comparator text, primary_outcomes text,
 start_date date, completion_date date, results_available boolean NOT NULL,
 source_url text NOT NULL CHECK(source_url ~ '^https://'),
 FOREIGN KEY(claim_id,revision_id) REFERENCES claim(id,revision_id), UNIQUE(revision_id,trial_id)
);
CREATE TABLE safety_record (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revision,
 claim_id uuid NOT NULL, category text NOT NULL CHECK(category IN ('adverse_event','toxicity','drug_interaction','contraindication','regulatory_warning','unknown_long_term_risk','immunogenicity','contamination_risk')),
 severity text NOT NULL, evidence_type evidence_type NOT NULL,
 known_or_theoretical text NOT NULL CHECK(known_or_theoretical IN ('observed','theoretical','unknown')),
 FOREIGN KEY(claim_id,revision_id) REFERENCES claim(id,revision_id)
);
CREATE TABLE regulatory_record (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revision,
 claim_id uuid NOT NULL, jurisdiction text NOT NULL, agency text NOT NULL,
 status text NOT NULL CHECK(status IN ('approved','investigational','not_approved','unclear')),
 record_type text NOT NULL CHECK(record_type IN ('drug_approval','investigational','compounding','warning','unknown')),
 product text, indication text, formulation text, route text, population text,
 effective_date date, verified_at timestamptz NOT NULL, observation_id uuid NOT NULL REFERENCES source_observation,
 FOREIGN KEY(claim_id,revision_id) REFERENCES claim(id,revision_id)
);
CREATE TABLE evidence_assessment (
 revision_id uuid NOT NULL REFERENCES revision,
 dimension text NOT NULL CHECK(dimension IN ('preclinical','human','clinical','safety','regulatory')),
 state knowledge_state NOT NULL, grade evidence_grade, rationale text NOT NULL,
 rubric_version text NOT NULL DEFAULT '1', search_completed_at timestamptz,
 search_scope text NOT NULL, reviewed_by uuid REFERENCES actor,
 PRIMARY KEY(revision_id,dimension), CHECK(state = 'known' OR grade IS NULL),
 CHECK(grade <> 'None Identified' OR search_completed_at IS NOT NULL),
 CHECK(dimension <> 'regulatory' OR grade IS NULL)
);
CREATE TABLE assessment_evidence (
 revision_id uuid NOT NULL, dimension text NOT NULL, evidence_id uuid NOT NULL REFERENCES evidence_record,
 PRIMARY KEY(revision_id,dimension,evidence_id),
 FOREIGN KEY(revision_id,dimension) REFERENCES evidence_assessment
);
CREATE TABLE peptide_relation (
 revision_id uuid NOT NULL REFERENCES revision, related_peptide_id uuid NOT NULL REFERENCES peptide,
 relation_type text NOT NULL CHECK(relation_type IN ('receptor_family','pathway','peptide_family','research_area','structural')),
 claim_id uuid NOT NULL, PRIMARY KEY(revision_id,related_peptide_id,relation_type),
 FOREIGN KEY(claim_id,revision_id) REFERENCES claim(id,revision_id)
);
CREATE TABLE claim_flag (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revision,
 claim_id uuid NOT NULL, code text NOT NULL, detail text NOT NULL,
 resolved_by uuid REFERENCES actor, resolution text, resolved_at timestamptz,
 FOREIGN KEY(claim_id,revision_id) REFERENCES claim(id,revision_id),
 CHECK(resolved_by IS NULL OR (length(trim(resolution)) > 0 AND resolved_at IS NOT NULL))
);
CREATE TABLE publication (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid UNIQUE NOT NULL,
 peptide_id uuid NOT NULL, published_by uuid NOT NULL REFERENCES actor,
 published_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL,
 FOREIGN KEY(revision_id,peptide_id) REFERENCES revision(id,peptide_id), UNIQUE(id,peptide_id)
);
CREATE TABLE active_publication (
 peptide_id uuid PRIMARY KEY REFERENCES peptide, publication_id uuid NOT NULL,
 FOREIGN KEY(publication_id,peptide_id) REFERENCES publication(id,peptide_id)
);
CREATE TABLE audit_event (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES actor,
 action text NOT NULL, entity_id uuid NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE research_job (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), peptide_id uuid NOT NULL REFERENCES peptide,
 revision_id uuid REFERENCES revision, requested_by uuid REFERENCES actor,
 kind text NOT NULL CHECK(kind IN ('discover','extract','refresh')),
 dedupe_key text UNIQUE NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','succeeded','failed')),
 attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, available_at timestamptz NOT NULL DEFAULT now(),
 error text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE TABLE discovery (
 job_id uuid NOT NULL REFERENCES research_job, observation_id uuid NOT NULL REFERENCES source_observation,
 query text NOT NULL, PRIMARY KEY(job_id,observation_id)
);
CREATE TABLE extraction (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), observation_id uuid NOT NULL REFERENCES source_observation,
 provider text NOT NULL, model text NOT NULL, prompt_version text NOT NULL,
 schema_version text NOT NULL, interpretation jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE review_task (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), peptide_id uuid NOT NULL REFERENCES peptide,
 job_id uuid REFERENCES research_job, reason text NOT NULL, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id,reason)
);
CREATE TABLE rate_bucket (key text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE TABLE analytics_daily (
 day date NOT NULL DEFAULT current_date, event text NOT NULL, audience text NOT NULL,
 count bigint NOT NULL DEFAULT 1, PRIMARY KEY(day,event,audience)
);

CREATE FUNCTION current_actor() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('wiki.actor_id',true),'')::uuid
$$;
CREATE FUNCTION has_role(allowed role_name[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
 SELECT EXISTS(SELECT 1 FROM actor WHERE id=current_actor() AND NOT disabled AND role=ANY(allowed))
$$;
CREATE FUNCTION require_editor() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=wiki,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM actor WHERE id=current_actor() AND NOT disabled AND is_human AND role IN ('editor','admin')) THEN
  RAISE EXCEPTION 'Authenticated human editor required';
 END IF;
END $$;

-- Every content write locks the revision; approval and publication take this same lock.
CREATE FUNCTION guard_revision_content() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE rid uuid; status_now editorial_status;
BEGIN
 IF TG_OP='UPDATE' AND NEW.revision_id<>OLD.revision_id THEN RAISE EXCEPTION 'Cannot move content between revisions'; END IF;
 rid := CASE WHEN TG_OP='DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
 SELECT status INTO status_now FROM revision WHERE id=rid FOR UPDATE;
 IF status_now IN ('approved','published','archived') THEN RAISE EXCEPTION 'Revision is frozen; create a new revision'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION guard_citation() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE cid uuid; rid uuid; status_now editorial_status;
BEGIN
 IF TG_OP='UPDATE' AND NEW.claim_id<>OLD.claim_id THEN RAISE EXCEPTION 'Cannot move citation'; END IF;
 cid:=CASE WHEN TG_OP='DELETE' THEN OLD.claim_id ELSE NEW.claim_id END;
 SELECT revision_id INTO rid FROM claim WHERE id=cid;
 SELECT status INTO status_now FROM revision WHERE id=rid FOR UPDATE;
 IF status_now IN ('approved','published','archived') THEN RAISE EXCEPTION 'Revision is frozen'; END IF;
 UPDATE claim SET approved=false,reviewed_by=NULL,reviewed_at=NULL WHERE id=cid;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION guard_claim_review() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.approved THEN RAISE EXCEPTION 'New claims require separate human review'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['approved','reviewed_by','reviewed_at','review_note']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['approved','reviewed_by','reviewed_at','review_note']) THEN
   NEW.approved:=false; NEW.reviewed_by:=NULL; NEW.reviewed_at:=NULL;
  ELSIF NEW.approved AND (NOT OLD.approved OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by) THEN
   PERFORM require_editor();
   IF NEW.reviewed_by IS DISTINCT FROM current_actor() THEN RAISE EXCEPTION 'Review identity mismatch'; END IF;
   IF NOT EXISTS(SELECT 1 FROM claim_citation WHERE claim_id=NEW.id AND relation='supports') THEN RAISE EXCEPTION 'Supporting citation required'; END IF;
   IF NEW.assertion_scope IN ('human','clinical') AND NEW.evidence_type IN ('in_vitro','animal','unknown') THEN RAISE EXCEPTION 'Preclinical evidence cannot support human efficacy'; END IF;
   NEW.reviewed_at:=now();
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION detect_claim_flags() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE term text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.claim_text=OLD.claim_text AND NEW.plain_text IS NOT DISTINCT FROM OLD.plain_text THEN RETURN NEW; END IF;
 DELETE FROM claim_flag WHERE claim_id=NEW.id;
 FOREACH term IN ARRAY ARRAY['treats','cures','prevents','reverses','guarantees','heals','boosts','burns fat','builds muscle','anti-aging','extends lifespan'] LOOP
  IF lower(NEW.claim_text||' '||coalesce(NEW.plain_text,'')) ~ ('\m'||term||'\M') THEN
   INSERT INTO claim_flag(revision_id,claim_id,code,detail) VALUES(NEW.revision_id,NEW.id,'language',term);
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER a_claim_content BEFORE INSERT OR UPDATE OR DELETE ON claim FOR EACH ROW EXECUTE FUNCTION guard_revision_content();
CREATE TRIGGER b_claim_review BEFORE INSERT OR UPDATE ON claim FOR EACH ROW EXECUTE FUNCTION guard_claim_review();
CREATE TRIGGER c_claim_flags AFTER INSERT OR UPDATE ON claim FOR EACH ROW EXECUTE FUNCTION detect_claim_flags();
CREATE TRIGGER citation_guard BEFORE INSERT OR UPDATE OR DELETE ON claim_citation FOR EACH ROW EXECUTE FUNCTION guard_citation();

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['peptide_profile','evidence_record','mechanism','revision_taxonomy','trial_record','safety_record','regulatory_record','evidence_assessment','assessment_evidence','peptide_relation','claim_flag'] LOOP
  EXECUTE format('CREATE TRIGGER content_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_revision_content()',t);
 END LOOP;
END $$;
CREATE FUNCTION immutable_row() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Immutable record'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['source','source_identifier','source_observation','publication','audit_event','extraction'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_guard BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_row()',t);
 END LOOP;
END $$;
CREATE FUNCTION guard_revision_state() RETURNS trigger LANGUAGE plpgsql SET search_path=wiki,public AS $$
BEGIN
 IF OLD.status IN ('approved','published','archived') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Frozen revision'; END IF;
 IF NEW.status IN ('approved','published') AND NEW.status IS DISTINCT FROM OLD.status AND current_setting('wiki.publishing',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Use publication operation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER revision_state_guard BEFORE UPDATE ON revision FOR EACH ROW EXECUTE FUNCTION guard_revision_state();

CREATE FUNCTION publish_revision(target uuid, reason_text text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=wiki,public AS $$
DECLARE rev revision; pub_id uuid;
BEGIN
 PERFORM require_editor();
 SELECT * INTO rev FROM revision WHERE id=target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Revision not found'; END IF;
 SELECT id INTO pub_id FROM publication WHERE revision_id=target;
 IF pub_id IS NOT NULL THEN RETURN pub_id; END IF;
 IF rev.status<>'needs_review' THEN RAISE EXCEPTION 'Submit revision for review first'; END IF;
 IF length(trim(reason_text))=0 THEN RAISE EXCEPTION 'Publication reason required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM claim WHERE revision_id=target) OR EXISTS(SELECT 1 FROM claim WHERE revision_id=target AND NOT approved) THEN RAISE EXCEPTION 'All visible claims require human approval'; END IF;
 IF EXISTS(SELECT 1 FROM claim c WHERE c.revision_id=target AND NOT EXISTS(SELECT 1 FROM claim_citation cc WHERE cc.claim_id=c.id AND relation='supports')) THEN RAISE EXCEPTION 'Every claim requires support'; END IF;
 IF EXISTS(SELECT 1 FROM claim_flag WHERE revision_id=target AND resolved_by IS NULL) THEN RAISE EXCEPTION 'Resolve claim flags'; END IF;
 IF (SELECT count(*) FROM evidence_assessment WHERE revision_id=target AND reviewed_by IS NOT NULL)<>5 THEN RAISE EXCEPTION 'Five reviewed evidence dimensions required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM regulatory_record WHERE revision_id=target AND jurisdiction='United States' AND agency='FDA') THEN RAISE EXCEPTION 'US regulatory record required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM claim WHERE revision_id=target AND section='unknowns') OR NOT EXISTS(SELECT 1 FROM safety_record WHERE revision_id=target) THEN RAISE EXCEPTION 'Safety and unknowns required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM claim WHERE revision_id=target AND section='overview') THEN RAISE EXCEPTION 'Overview required'; END IF;
 PERFORM set_config('wiki.publishing','yes',true);
 UPDATE revision SET status='published',last_reviewed_at=now(),next_review_due=current_date+90,review_reason=reason_text WHERE id=target;
 INSERT INTO publication(revision_id,peptide_id,published_by,reason) VALUES(target,rev.peptide_id,current_actor(),reason_text) RETURNING id INTO pub_id;
 INSERT INTO active_publication VALUES(rev.peptide_id,pub_id) ON CONFLICT(peptide_id) DO UPDATE SET publication_id=excluded.publication_id;
 INSERT INTO audit_event(actor_id,action,entity_id,reason) VALUES(current_actor(),'publish',target,reason_text);
 RETURN pub_id;
END $$;

CREATE VIEW published_revision AS SELECT r.* FROM active_publication a JOIN publication p ON p.id=a.publication_id JOIN revision r ON r.id=p.revision_id;
CREATE VIEW public_search AS
 SELECT p.id,p.slug,p.canonical_name,r.id AS revision_id,
 coalesce((SELECT string_agg(alias,' ') FROM peptide_alias WHERE peptide_id=p.id),'') AS aliases,
 to_tsvector('english',p.canonical_name||' '||coalesce((SELECT string_agg(alias,' ') FROM peptide_alias WHERE peptide_id=p.id),'')||' '||coalesce((SELECT string_agg(claim_text,' ') FROM claim WHERE revision_id=r.id),'')||' '||coalesce((SELECT string_agg(coalesce(target,'')||' '||coalesce(pathway,''),' ') FROM mechanism WHERE revision_id=r.id),'')||' '||coalesce((SELECT string_agg(label_snapshot,' ') FROM revision_taxonomy WHERE revision_id=r.id),'')) AS document
 FROM peptide p JOIN published_revision r ON r.peptide_id=p.id;

-- Runtime role is restricted to authenticated server transactions. Credentials never reach the browser.
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='peppy_app') THEN CREATE ROLE peppy_app NOLOGIN; END IF; END $$;
GRANT USAGE ON SCHEMA wiki TO peppy_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA wiki TO peppy_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA wiki TO peppy_app;
REVOKE ALL ON actor,session FROM peppy_app;
REVOKE INSERT,UPDATE,DELETE ON publication,active_publication,audit_event FROM peppy_app;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA wiki FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_actor(),has_role(role_name[]),require_editor(),publish_revision(uuid,text) TO peppy_app;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['peptide','peptide_identifier','peptide_alias','taxonomy','revision','peptide_profile','source','source_identifier','source_observation','study','study_source','claim','claim_citation','evidence_record','mechanism','revision_taxonomy','clinical_trial','trial_record','safety_record','regulatory_record','evidence_assessment','assessment_evidence','peptide_relation','claim_flag','research_job','discovery','extraction','review_task'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY researcher_access ON %I FOR ALL TO peppy_app USING (has_role(ARRAY[''researcher'',''editor'',''admin'']::role_name[])) WITH CHECK (has_role(ARRAY[''researcher'',''editor'',''admin'']::role_name[]))',t);
 END LOOP;
END $$;
CREATE POLICY published_peptide ON peptide FOR SELECT TO peppy_app USING(EXISTS(SELECT 1 FROM active_publication WHERE peptide_id=peptide.id));
CREATE POLICY published_revision_read ON revision FOR SELECT TO peppy_app USING(EXISTS(SELECT 1 FROM publication p JOIN active_publication a ON a.publication_id=p.id WHERE p.revision_id=revision.id));
CREATE POLICY published_claim_read ON claim FOR SELECT TO peppy_app USING(EXISTS(SELECT 1 FROM published_revision WHERE id=claim.revision_id));

COMMIT;
