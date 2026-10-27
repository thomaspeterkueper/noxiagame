-- NOXIA-FOOD-0001, Stufe 1a: Lebensmittel als Ware.
-- Eigene Migration, damit PostgreSQL den Enum-Wert festschreibt, bevor spätere
-- Migrationen 'food' in typisierten INSERTs verwenden (Muster: components).

ALTER TYPE public.resource_type ADD VALUE IF NOT EXISTS 'food';
