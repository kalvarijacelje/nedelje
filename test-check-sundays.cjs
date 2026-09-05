const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ptdvcobgplmngnhkjqag.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZHZjb2JncGxtbmduaGtqcWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTIwNzcsImV4cCI6MjEwMjk4ODA3N30.i9-UFVwAavIuDZO51YEkL0-yt6Rzmg6ZkMGqkRl_JMo";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSundays() {
  console.log('Fetching 6. 9. 2026 from nedelje_services...');
  const { data: services, error: sErr } = await supabase
    .from('nedelje_services')
    .select('*')
    .or('id.eq.s_2026_09_06,id.eq.s-2026-09-06,date.eq.6. 9. 2026');

  console.log('Services match for 6.9.2026:', services);

  console.log('\nFetching assignments for 6. 9. 2026 from nedelje_assignments...');
  const { data: assigns, error: aErr } = await supabase
    .from('nedelje_assignments')
    .select('*')
    .or('sunday_id.eq.s_2026_09_06,sunday_id.eq.s-2026-09-06');

  console.log('Assignments for 6.9.2026 in Supabase:', assigns);
}

checkSundays();
