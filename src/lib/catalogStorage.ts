import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseApp } from "./firebaseClient";
import { getStorage } from "firebase/storage";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PHOTOS = 6;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateCatalogPhotos(files: File[]): string[] {
  if (files.length > MAX_PHOTOS) return [`You can upload a maximum of ${MAX_PHOTOS} photos.`];
  return files.flatMap((file) => {
    if (!ALLOWED_TYPES.has(file.type)) return [`${file.name}: use JPG, PNG or WebP images only.`];
    if (file.size > MAX_FILE_SIZE) return [`${file.name}: photo must be 5 MB or smaller.`];
    return [];
  });
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const longestSide = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 1600 / longestSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image compression failed.")), "image/webp", 0.84));
}

export async function uploadCatalogPhotos(factoryId: string, listingId: string, files: File[]): Promise<string[]> {
  const errors = validateCatalogPhotos(files);
  if (errors.length) throw new Error(errors.join(" "));
  if (!firebaseApp) throw new Error("Firebase is not configured. Add the Firebase environment variables before uploading photos.");
  const storage = getStorage(firebaseApp);
  return Promise.all(files.map(async (file, index) => {
    const image = await compressImage(file);
    const photoRef = ref(storage, `factories/${factoryId}/catalog/${listingId}/${Date.now()}-${index}.webp`);
    await uploadBytes(photoRef, image, { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable" });
    return getDownloadURL(photoRef);
  }));
}
