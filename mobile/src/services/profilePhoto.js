import { launchImageLibraryAsync } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { PROFILE_PHOTO_PREFIX, PROFILE_PHOTO_SIZE, profilePhotoSource } from '../../../shared/profilePhoto.mjs';

export async function pickProfilePhoto() {
  const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri || !(asset.width > 0 && asset.height > 0)) throw new Error('Could not open this photo. Choose another one.');

  const image = ImageManipulator.manipulate(asset.uri);
  const side = Math.min(asset.width, asset.height);
  try {
    if (asset.width !== asset.height) {
      image.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
    }
    if (side > PROFILE_PHOTO_SIZE) image.resize({ width: PROFILE_PHOTO_SIZE });
    const rendered = await image.renderAsync();
    try {
      const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      const uri = profilePhotoSource(PROFILE_PHOTO_PREFIX + (photo.base64 || ''));
      if (!uri) throw new Error('Could not prepare this photo. Choose another one.');
      return uri;
    } finally {
      rendered.release();
    }
  } finally {
    image.release();
  }
}
