import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnwiqirwjeeeahsjgzwg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxud2lxaXJ3amVlZWFoc2pnendnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTM0NTIsImV4cCI6MjA4NTQyOTQ1Mn0.t0Bv0CBl5CSrFe3VVaUNJXsnvtIN1sJ5y6J7tRTgWE0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Member {
  id: number;
  user_id: string | null;
  email: string;
  name: string | null;
  role: string;
  status: string;
  joined_at: string;
}

export interface DBHistoryItem {
  id: string;
  member_id: number | null;
  title: string;
  original_problem: string;
  analysis_data: any;
  report_markdown: string;
  created_at: string;
}
