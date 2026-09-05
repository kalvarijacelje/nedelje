const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ptdvcobgplmngnhkjqag.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZHZjb2JncGxtbmduaGtqcWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTIwNzcsImV4cCI6MjEwMjk4ODA3N30.i9-UFVwAavIuDZO51YEkL0-yt6Rzmg6ZkMGqkRl_JMo";
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAllAssignments() {
  const { data, error } = await supabase
    .from('nedelje_assignments')
    .select('id, sunday_id, ministry_id, person_name, status')
    .eq('sunday_id', 's-2026-09-06');

  console.log('All assignments in Supabase for s-2026-09-06:');
  console.table(data);
}

inspectAllAssignments();
