-- NOXIA component resource compatibility
-- Keep this in its own migration so PostgreSQL commits the enum value before
-- later migrations use 'components' in typed INSERTs.

ALTER TYPE public.resource_type ADD VALUE IF NOT EXISTS 'components';
