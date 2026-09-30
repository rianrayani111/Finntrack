// Belt-and-suspenders alongside the 'proof-photos' bucket's own
// file_size_limit (see migration 0021) -- this one runs before any network
// request at all, so a huge phone photo never gets uploaded just to be
// rejected server-side.
export const MAX_PHOTO_BLOB_BYTES = 1_000_000;

// A task photo only has to show that a chore got done. A receipt has to stay
// legible -- its line items and total are the whole point, and at 800px and
// JPEG quality 0.6 they usually weren't, which left "require a receipt for
// refunds" proving nothing.
//
// Each preset is a ladder tried in order, and the first rung whose output fits
// under MAX_PHOTO_BLOB_BYTES wins. The receipt ladder ends on the original
// 800px / 0.6 setting, so any photo that could be attached before still can
// be: the sharper rungs are a pure improvement, never a new way to fail.
export const PHOTO_PRESETS = {
  task: [{ maxDimension: 800, quality: 0.6 }],
  receipt: [
    { maxDimension: 1600, quality: 0.8 },
    { maxDimension: 1600, quality: 0.7 },
    { maxDimension: 1280, quality: 0.7 },
    { maxDimension: 1024, quality: 0.65 },
    { maxDimension: 800, quality: 0.6 },
  ],
};

const readImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });

const renderJpeg = (img, { maxDimension, quality }) =>
  new Promise((resolve, reject) => {
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      quality
    );
  });

// Compresses a File into a JPEG Blob using the given preset ('task' or
// 'receipt'). The image is decoded once and re-encoded per rung. Returns the
// blob (for uploading to Supabase Storage, see storageApi.uploadProofPhoto in
// src/api/db.js) alongside a local object URL for an immediate preview --
// URL.createObjectURL needs no network round trip, so the preview appears
// before the upload even starts. Callers must URL.revokeObjectURL(previewUrl)
// when they're done with it (on removal, on successful submit, and on unmount)
// or the blob leaks for the tab's lifetime. If even the last rung is over the
// size cap the oversized blob is returned as before, and the caller's own
// MAX_PHOTO_BLOB_BYTES check rejects it.
export const compressImageFile = async (file, preset = 'task') => {
  const img = await readImage(file);
  const ladder = PHOTO_PRESETS[preset] || PHOTO_PRESETS.task;
  let blob = null;
  for (const rung of ladder) {
    blob = await renderJpeg(img, rung);
    if (blob.size <= MAX_PHOTO_BLOB_BYTES) break;
  }
  return { blob, previewUrl: URL.createObjectURL(blob) };
};
