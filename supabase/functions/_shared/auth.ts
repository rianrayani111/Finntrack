import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Verifies the caller's JWT (forwarded from the browser) and confirms they are a
 * signed-in parent. Uses the anon key + the caller's own Authorization header, so
 * RLS applies to the profile lookup exactly as it would from the client.
 */
export async function requireParent(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new HttpError(401, 'Missing Authorization header.');
  }

  const scopedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await scopedClient.auth.getUser();
  if (userError || !userData?.user) {
    throw new HttpError(401, 'Not authenticated.');
  }

  const { data: profile, error: profileError } = await scopedClient
    .from('profiles')
    .select('id, role, parent_id')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    throw new HttpError(403, 'No profile found for this account.');
  }
  if (profile.role !== 'parent') {
    throw new HttpError(403, 'Only a parent can perform this action.');
  }

  return { uid: profile.id as string };
}

/**
 * Same as requireParent, for educator accounts (schools & institutions).
 */
export async function requireEducator(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new HttpError(401, 'Missing Authorization header.');
  }

  const scopedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await scopedClient.auth.getUser();
  if (userError || !userData?.user) {
    throw new HttpError(401, 'Not authenticated.');
  }

  const { data: profile, error: profileError } = await scopedClient
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    throw new HttpError(403, 'No profile found for this account.');
  }
  if (profile.role !== 'educator') {
    throw new HttpError(403, 'Only an educator can perform this action.');
  }

  return { uid: profile.id as string };
}

/**
 * Creates the profile row for an account the admin API just made, and
 * deletes that account if it fails.
 *
 * The signup trigger only fills profiles when raw_app_meta_data is already
 * populated, which this project's GoTrue does not guarantee at INSERT time
 * (see migration 0035). These finalize functions are granted to
 * service_role only, so the anon key still cannot create a child, student
 * or teacher.
 */
export async function finalizeAccountOrDelete(
  userId: string,
  fn: 'finn_finalize_child' | 'edu_finalize_student' | 'edu_finalize_educator',
  args: Record<string, unknown>
) {
  const { error } = await supabaseAdmin.rpc(fn, args);
  if (!error) return;

  // An account with no profile cannot log in, so never leave one behind.
  await supabaseAdmin.auth.admin.deleteUser(userId);
  throw new HttpError(400, error.message || 'Could not finish creating that account.');
}
