-- Scientific samples are logistics cargo, not market metal/components.
-- Adding a dedicated enum value lets the existing transport core move them
-- without misrepresenting their scientific meaning.

alter type public.resource_type add value if not exists 'research_sample';
