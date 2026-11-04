export const MAX_HANDOVER_IMAGE_BYTES = 1024 * 1024;

export function validateHandoverImage(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_HANDOVER_IMAGE_BYTES / 3) * 4 + 40) return false;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_HANDOVER_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return false;
  return match[1] === 'jpeg' ? bytes.length > 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    : match[1] === 'png' ? bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}
