BEGIN;
SET search_path=wiki,public;
ALTER FUNCTION article_data(uuid,boolean) RENAME TO related_article_data;
REVOKE EXECUTE ON FUNCTION related_article_data(uuid,boolean) FROM peppy_app;
CREATE FUNCTION article_data(target uuid,preview boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
DECLARE article jsonb; rid uuid;
BEGIN
 article:=related_article_data(target,preview);
 IF article IS NULL THEN RETURN NULL; END IF;
 rid:=(article->>'revisionId')::uuid;
 RETURN article||jsonb_build_object('evidenceRecords',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('study_design',s.study_design,'species',s.species,'population',s.population,'sample_size',s.sample_size)) FROM evidence_record e JOIN study s ON s.id=e.study_id WHERE e.revision_id=rid),'[]'));
END $$;
REVOKE EXECUTE ON FUNCTION article_data(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION article_data(uuid,boolean) TO peppy_app;
CREATE FUNCTION log_action(action_text text,target uuid,reason_text text,detail jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=wiki,public AS $$
 INSERT INTO audit_event(actor_id,action,entity_id,reason,details) SELECT current_actor(),action_text,target,reason_text,detail WHERE has_role(ARRAY['researcher','editor','admin']::role_name[])
$$;
REVOKE EXECUTE ON FUNCTION log_action(text,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_action(text,uuid,text,jsonb) TO peppy_app;
COMMIT;
