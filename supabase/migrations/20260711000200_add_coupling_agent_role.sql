ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN (
    'Coupling Agent',
    'Driver',
    'Yard Auditor',
    'Workshop',
    'Fleet Assistant',
    'Fleet Analyst',
    'Supervisor',
    'Operations Manager',
    'Coordinator',
    'Manager',
    'Director',
    'Admin Master'
  ));

NOTIFY pgrst, 'reload schema';
