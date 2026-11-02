export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function validatePhoto(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Please choose a JPEG or PNG image.');
  }
  if (!Number.isInteger(file.size) || file.size < 1 || file.size > MAX_PHOTO_BYTES) {
    throw new Error('Photo must be between 1 byte and 5 MB.');
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signature = file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10] : [255, 216, 255];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new Error('This file does not appear to be a valid JPEG or PNG.');
  }
}
