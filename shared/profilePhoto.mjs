export const PROFILE_PHOTO_SIZE = 256;
export const PROFILE_PHOTO_MAX_LENGTH = 200000;
export const PROFILE_PHOTO_PREFIX = 'data:image/jpeg;base64,';

export function profilePhotoSource(value) {
  return typeof value === 'string' && value.length <= PROFILE_PHOTO_MAX_LENGTH
    && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
}

export function profileInitial(name) {
  return (typeof name === 'string' && name.trim().charAt(0).toUpperCase()) || 'U';
}
