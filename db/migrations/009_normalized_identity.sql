BEGIN;
CREATE UNIQUE INDEX peptide_canonical_normalized ON wiki.peptide((regexp_replace(lower(canonical_name),'[^a-z0-9]','','g')));
COMMIT;
