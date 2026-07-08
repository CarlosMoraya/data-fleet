-- role_ranks is the single source of truth for database role levels.
-- Keep it manually synchronized with ROLE_RANK in src/lib/rolePermissions.ts
-- until a future session unifies the frontend source as well.
-- New roles, such as "Financeiro", must be added with INSERTs into this table;
-- do not rewrite the entire role_rank() function again.

CREATE TABLE public.role_ranks (
  role TEXT PRIMARY KEY,
  rank INT NOT NULL
);

ALTER TABLE public.role_ranks ENABLE ROW LEVEL SECURITY;

INSERT INTO public.role_ranks (role, rank) VALUES
  ('Coupling Agent', 0),
  ('Driver', 0),
  ('Yard Auditor', 1),
  ('Workshop', 2),
  ('Fleet Assistant', 3),
  ('Fleet Analyst', 4),
  ('Supervisor', 5),
  ('Operations Manager', 5),
  ('Coordinator', 6),
  ('Manager', 7),
  ('Director', 8),
  ('Admin Master', 9);

CREATE OR REPLACE FUNCTION public.role_rank(role_name TEXT) RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT rank FROM public.role_ranks WHERE role = role_name), 0);
$$;
