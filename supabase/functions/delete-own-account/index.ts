import { corsHeaders, HttpError, requireParent, supabaseAdmin } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { uid: parentUid } = await requireParent(req);

    const { data: children, error: childrenError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('parent_id', parentUid);
    if (childrenError) throw new HttpError(500, childrenError.message);

    // Delete each child's auth user first. The profiles FK cascade (parent_id
    // -> profiles.id) only removes the child *profile* row when the parent
    // profile is deleted — it doesn't reach back up to delete the child's
    // auth.users row, which would otherwise be left behind as an orphaned login.
    for (const child of children || []) {
      const { error: childDeleteError } = await supabaseAdmin.auth.admin.deleteUser(child.id);
      if (childDeleteError) throw new HttpError(500, childDeleteError.message);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(parentUid);
    if (deleteError) throw new HttpError(500, deleteError.message);

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
