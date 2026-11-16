"""Shared image preparation for live report matching and offline evaluation."""
from PIL import ImageOps

REPORT_IMAGE_PROFILE = {
    'name': 'report-image-v1',
    'orientation': 'EXIF transpose',
    'color': 'RGB',
    'maximum_side': 512,
    'resize': 'Pillow thumbnail default (BICUBIC, reducing_gap=2.0)',
    'model_preprocessing': 'checkpoint-specific processor / weights.transforms()',
}


def prepare_report_image(image):
    """Return a new image; do not mutate a caller's original photograph."""
    prepared = ImageOps.exif_transpose(image).convert('RGB')
    prepared.thumbnail((512, 512))
    return prepared
