BEGIN;
SET search_path=wiki,public;
-- One source can match several queries; each match is search provenance.
ALTER TABLE discovery DROP CONSTRAINT discovery_pkey;
ALTER TABLE discovery ADD PRIMARY KEY (job_id,observation_id,query);
COMMIT;
