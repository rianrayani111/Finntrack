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
