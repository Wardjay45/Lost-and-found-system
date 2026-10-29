// Map the visible crop frame back to source pixels. Panning is normalized
// so the selection stays inside the photo at every zoom and aspect ratio.
export function getCropRect(width, height, aspect, zoom = 1, pan = { x: 0, y: 0 }) {
  const cropWidth = Math.min(width, height * aspect) / Math.max(1, zoom);
  const cropHeight = cropWidth / aspect;
  const clamp = value => Math.max(-1, Math.min(1, value || 0));
  return {
    x: (width - cropWidth) / 2 * (1 - clamp(pan.x)),
    y: (height - cropHeight) / 2 * (1 - clamp(pan.y)),
    width: cropWidth,
    height: cropHeight,
  };
}

export async function exportCrop(image, crop) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1600 / Math.max(crop.width, crop.height));
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image editing is unavailable in this browser.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
  if (!blob) throw new Error('Unable to save the crop. Please try again.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the cropped image.'));
    reader.readAsDataURL(blob);
  });
}
