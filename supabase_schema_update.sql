
-- Drop existing analysis_history if it exists (to recreate with correct foreign key type)
-- Be careful in production, but for dev this ensures schema consistency
drop table if exists analysis_history;

-- Create analysis_history table referencing pm_members
create table if not exists analysis_history (
  id uuid primary key default uuid_generate_v4(),
  member_id bigint references pm_members(id), -- References the bigint id of pm_members
  title text,
  original_problem text,
  analysis_data jsonb,
  report_markdown text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add index for performance
create index if not exists analysis_history_member_id_idx on analysis_history(member_id);
