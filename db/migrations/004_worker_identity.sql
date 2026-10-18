BEGIN;
SET search_path=wiki,public;
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='peppy_web') THEN CREATE ROLE peppy_web NOLOGIN; END IF; END $$;
CREATE TABLE runtime_identity(login_name text PRIMARY KEY,actor_id uuid NOT NULL REFERENCES actor);
REVOKE ALL ON runtime_identity FROM PUBLIC,peppy_app;
CREATE OR REPLACE FUNCTION current_actor() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=wiki,public AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM runtime_identity WHERE login_name=session_user) THEN (SELECT actor_id FROM runtime_identity WHERE login_name=session_user) ELSE NULLIF(current_setting('wiki.actor_id',true),'')::uuid END
$$;
REVOKE EXECUTE ON FUNCTION auth_credentials(text),auth_session(text),auth_create_session(uuid,text),auth_delete_session(text) FROM peppy_app;
GRANT EXECUTE ON FUNCTION auth_credentials(text),auth_session(text),auth_create_session(uuid,text),auth_delete_session(text) TO peppy_web;
DO $$ BEGIN IF EXISTS(SELECT FROM pg_roles WHERE rolname='peppy_server') THEN GRANT peppy_web TO peppy_server; END IF; END $$;
COMMIT;
