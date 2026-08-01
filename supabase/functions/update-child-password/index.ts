import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uid: parentUid } = await requireParent(req);

    const body = await req.json().catch(() => ({}));
    const childUid = String(body.childUid || '').trim();
    const password = String(body.password || '');

    if (!childUid) throw new HttpError(400, 'childUid is required.');
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');

    const { data: child, error: childError } = await supabaseAdmin
      .from('profiles')
      .select('id, parent_id')
      .eq('id', childUid)
      .single();

    if (childError || !child) {
      throw new HttpError(404, 'That child account does not exist.');
    }
    if (child.parent_id !== parentUid) {
      throw new HttpError(403, 'That child account does not belong to your family.');
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(childUid, { password });
    if (updateError) throw new HttpError(500, updateError.message);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
