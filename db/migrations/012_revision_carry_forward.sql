BEGIN;
SET search_path=wiki,public;
-- Starts a draft from an earlier revision. Content is copied, but nothing
-- inherits trust: every claim returns to unreviewed and every evidence
-- assessment loses its reviewer, so a human editor must re-review before the
-- new revision can publish. Runs as the caller, so row-level security and all
-- content guards apply exactly as they do to hand-entered rows.
-- jsonb_populate_record copies by column name, so later columns carry over too.
CREATE FUNCTION carry_forward_revision(src uuid,dst uuid) RETURNS void LANGUAGE plpgsql SET search_path=wiki,public AS $$
DECLARE
 c claim; e evidence_record; new_id uuid;
 old_claims uuid[]:='{}'; new_claims uuid[]:='{}';
 old_evidence uuid[]:='{}'; new_evidence uuid[]:='{}';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM revision n JOIN revision o ON o.peptide_id=n.peptide_id WHERE n.id=dst AND n.parent_id=src AND o.id=src) THEN
  RAISE EXCEPTION 'Carry forward requires a new revision of the same peptide that descends from the source';
 END IF;
 IF EXISTS(SELECT 1 FROM claim WHERE revision_id=dst) THEN RAISE EXCEPTION 'Revision already has content'; END IF;
 INSERT INTO peptide_profile SELECT (jsonb_populate_record(NULL::peptide_profile,to_jsonb(p)||jsonb_build_object('revision_id',dst))).* FROM peptide_profile p WHERE p.revision_id=src;
 FOR c IN SELECT * FROM claim WHERE revision_id=src ORDER BY sort_order,id LOOP
  new_id:=gen_random_uuid();
  INSERT INTO claim SELECT (jsonb_populate_record(NULL::claim,to_jsonb(c)||jsonb_build_object('id',new_id,'revision_id',dst,'approved',false,'reviewed_by',NULL,'reviewed_at',NULL,'review_note',NULL))).*;
  old_claims:=old_claims||c.id; new_claims:=new_claims||new_id;
 END LOOP;
 INSERT INTO claim_citation(claim_id,observation_id,locator,relation)
  SELECT new_claims[array_position(old_claims,cc.claim_id)],cc.observation_id,cc.locator,cc.relation FROM claim_citation cc WHERE cc.claim_id=ANY(old_claims);
 FOR e IN SELECT * FROM evidence_record WHERE revision_id=src ORDER BY id LOOP
  new_id:=gen_random_uuid();
  INSERT INTO evidence_record SELECT (jsonb_populate_record(NULL::evidence_record,to_jsonb(e)||jsonb_build_object('id',new_id,'revision_id',dst,'claim_id',new_claims[array_position(old_claims,e.claim_id)],'editorial_status','draft'))).*;
  old_evidence:=old_evidence||e.id; new_evidence:=new_evidence||new_id;
 END LOOP;
 -- Prior grades are a starting point only; with no reviewer they cannot satisfy publication.
 INSERT INTO evidence_assessment SELECT (jsonb_populate_record(NULL::evidence_assessment,to_jsonb(a)||jsonb_build_object('revision_id',dst,'reviewed_by',NULL))).* FROM evidence_assessment a WHERE a.revision_id=src;
 INSERT INTO assessment_evidence(revision_id,dimension,evidence_id)
  SELECT dst,ae.dimension,new_evidence[array_position(old_evidence,ae.evidence_id)] FROM assessment_evidence ae WHERE ae.revision_id=src;
 INSERT INTO mechanism SELECT (jsonb_populate_record(NULL::mechanism,to_jsonb(m)||jsonb_build_object('id',gen_random_uuid(),'revision_id',dst,'claim_id',new_claims[array_position(old_claims,m.claim_id)]))).* FROM mechanism m WHERE m.revision_id=src;
 INSERT INTO revision_taxonomy SELECT (jsonb_populate_record(NULL::revision_taxonomy,to_jsonb(t)||jsonb_build_object('revision_id',dst,'claim_id',new_claims[array_position(old_claims,t.claim_id)]))).* FROM revision_taxonomy t WHERE t.revision_id=src;
 INSERT INTO trial_record SELECT (jsonb_populate_record(NULL::trial_record,to_jsonb(t)||jsonb_build_object('id',gen_random_uuid(),'revision_id',dst,'claim_id',new_claims[array_position(old_claims,t.claim_id)]))).* FROM trial_record t WHERE t.revision_id=src;
 INSERT INTO safety_record SELECT (jsonb_populate_record(NULL::safety_record,to_jsonb(s)||jsonb_build_object('id',gen_random_uuid(),'revision_id',dst,'claim_id',new_claims[array_position(old_claims,s.claim_id)]))).* FROM safety_record s WHERE s.revision_id=src;
 INSERT INTO regulatory_record SELECT (jsonb_populate_record(NULL::regulatory_record,to_jsonb(r)||jsonb_build_object('id',gen_random_uuid(),'revision_id',dst,'claim_id',new_claims[array_position(old_claims,r.claim_id)]))).* FROM regulatory_record r WHERE r.revision_id=src;
 INSERT INTO peptide_relation SELECT (jsonb_populate_record(NULL::peptide_relation,to_jsonb(r)||jsonb_build_object('revision_id',dst,'claim_id',new_claims[array_position(old_claims,r.claim_id)]))).* FROM peptide_relation r WHERE r.revision_id=src;
END $$;
REVOKE EXECUTE ON FUNCTION carry_forward_revision(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION carry_forward_revision(uuid,uuid) TO peppy_app;
COMMIT;
