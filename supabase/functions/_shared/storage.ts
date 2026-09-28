import { HttpError, supabaseAdmin } from './auth.ts';

const PROOF_PHOTO_BUCKET = 'proof-photos';

// Supabase Storage's list() returns at most `limit` objects per call (default
// 100). A child who has logged receipts for a couple of years easily has more
// than that, and a loop that fetched one page and stopped would look perfect
// in testing with three photos while silently leaving the rest behind forever.
const LIST_PAGE_SIZE = 100;

// Hard stop so a remove() that reports success without actually deleting can't
// spin this forever. 1,000 pages is 100,000 photos for one user -- far beyond
// anything real, so hitting it means something is wrong, not that there was
// legitimately that much.
const MAX_PAGES = 1000;

/**
 * Permanently deletes every proof photo a user uploaded.
 *
 * Proof photos live at `proof-photos/{uploader_uid}/{uuid}.jpg` (see
 * storageApi.uploadProofPhoto in src/api/db.js and migration 0021). They are
 * objects in a bucket, not rows, so the ON DELETE CASCADE that removes a
 * user's profile, transactions, requests and tasks when auth.admin.deleteUser
 * runs never reaches them. Without this, photos taken by children outlived the
 * account indefinitely -- contradicting the Terms' deletion promise and
 * COPPA's expectation that a child's data goes when the parent asks.
 *
 * Call it BEFORE deleteUser. If it throws, the caller should abort: the user
 * still exists, nothing is half-deleted, and the request is safe to retry.
 * The reverse order would leave photos stranded under a uid nobody owns.
 *
 * Throws HttpError(500) on any storage failure.
 */
export async function deleteProofPhotosFor(uid: string): Promise<number> {
  const bucket = supabaseAdmin.storage.from(PROOF_PHOTO_BUCKET);
  let deleted = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    // Always offset 0: each pass deletes exactly what it just listed, so the
    // next list() naturally returns the next batch. Advancing an offset while
    // also deleting would skip every other page.
    const { data, error } = await bucket.list(uid, { limit: LIST_PAGE_SIZE, offset: 0 });
    if (error) {
      throw new HttpError(500, `Could not list photos for deletion: ${error.message}`);
    }
    if (!data || data.length === 0) return deleted;

    const paths = data.map((object) => `${uid}/${object.name}`);
    const { error: removeError } = await bucket.remove(paths);
    if (removeError) {
      throw new HttpError(500, `Could not delete photos: ${removeError.message}`);
    }
    deleted += paths.length;

    if (data.length < LIST_PAGE_SIZE) return deleted;
  }

  throw new HttpError(
    500,
    `Stopped deleting photos for ${uid} after ${MAX_PAGES} pages; storage may not be removing objects.`
  );
}
