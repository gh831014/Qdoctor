
-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. Member Table
create table if not exists member (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Analysis History Table
create table if not exists analysis_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references member(id), -- Nullable for guests
  title text,
  original_problem text,
  analysis_data jsonb,
  report_markdown text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add indexes for performance
create index if not exists analysis_history_user_id_idx on analysis_history(user_id);
