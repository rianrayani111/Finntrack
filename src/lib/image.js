export const MAX_PHOTO_DIMENSION = 800;
// Belt-and-suspenders alongside the 'proof-photos' bucket's own
// file_size_limit (see migration 0021) -- this one runs before any network
// request at all, so a huge phone photo never gets uploaded just to be
// rejected server-side.
export const MAX_PHOTO_BLOB_BYTES = 1_000_000;

// Compresses a File into a JPEG Blob no larger than MAX_PHOTO_DIMENSION on its
// longest side. Returns the blob (for uploading to Supabase Storage, see
// storageApi.uploadProofPhoto in src/api/db.js) alongside a local object URL
// for an immediate preview -- URL.createObjectURL needs no network round trip,
// so the preview appears before the upload even starts. Callers must
// URL.revokeObjectURL(previewUrl) when they're done with it (on removal, on
// successful submit, and on unmount) or the blob leaks for the tab's lifetime.
export const compressImageFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not process that image.'));
              return;
            }
            resolve({ blob, previewUrl: URL.createObjectURL(blob) });
          },
          'image/jpeg',
          0.6
        );
      };
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
