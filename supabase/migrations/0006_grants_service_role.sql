-- Les tables ayant été créées en SQL brut, les grants auto de Supabase pour
-- service_role n'ont pas été appliqués. On les accorde explicitement.
-- service_role contourne la RLS mais a quand même besoin des GRANT niveau table.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Filet : que les futures tables/séquences soient aussi accessibles.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
