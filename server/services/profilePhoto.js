import { PROFILE_PHOTO_PREFIX, PROFILE_PHOTO_SIZE, profilePhotoSource } from '../../shared/profilePhoto.mjs';

export function isValidProfilePhoto(value) {
  if (!profilePhotoSource(value)) return false;
  const encoded = value.slice(PROFILE_PHOTO_PREFIX.length);
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return false;

  // Read the JPEG frame size without decoding image pixels.
  let hasFrame = false;
  for (let offset = 2; offset + 4 < bytes.length;) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (offset + 2 > bytes.length) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return false;
    if (marker === 0xda) return hasFrame && length >= 6 && offset + length < bytes.length - 2;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return false;
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (hasFrame || width < 1 || height < 1 || Math.max(width, height) > PROFILE_PHOTO_SIZE) return false;
      hasFrame = true;
    }
    offset += length;
  }
  return false;
}
