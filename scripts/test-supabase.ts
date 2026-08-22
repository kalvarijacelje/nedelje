import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('Testing Supabase connection with URL:', url);
console.log('Key length:', key.length);

const supabase = createClient(url, key);

async function test() {
  // Test profiles
  const { data: prof, error: profErr } = await supabase.from('profiles').select('count').limit(1);
  console.log('profiles table result:', { data: prof, error: profErr?.message });

  // Test service_sundays
  const { data: sun, error: sunErr } = await supabase.from('service_sundays').select('count').limit(1);
  console.log('service_sundays table result:', { data: sun, error: sunErr?.message });

  // Test nedelje_services
  const { data: nedSun, error: nedSunErr } = await supabase.from('nedelje_services').select('count').limit(1);
  console.log('nedelje_services table result:', { data: nedSun, error: nedSunErr?.message });

  // Test ministries
  const { data: min, error: minErr } = await supabase.from('ministries').select('count').limit(1);
  console.log('ministries table result:', { data: min, error: minErr?.message });

  // Test nedelje_ministries
  const { data: nedMin, error: nedMinErr } = await supabase.from('nedelje_ministries').select('count').limit(1);
  console.log('nedelje_ministries table result:', { data: nedMin, error: nedMinErr?.message });
}

test().catch(console.error);
