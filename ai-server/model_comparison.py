"""Admin-only comparison endpoints, isolated from stored production embeddings."""
import base64
import io
import logging
import os
import threading
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator
from PIL import Image, ImageOps, UnidentifiedImageError
import torch
import torch.nn.functional as F

from comparison_metrics import rank_scores, summarize_ranking

MODELS = {
    'clip': {'name': 'CLIP ViT-B/32', 'modality': 'image'},
    'resnet50': {'name': 'ResNet50', 'modality': 'image'},
    'efficientnet-b0': {'name': 'EfficientNet-B0', 'modality': 'image'},
    'e5': {'name': 'E5-base-v2', 'modality': 'text'},
    'minilm': {'name': 'all-MiniLM-L6-v2', 'modality': 'text'},
    'mpnet': {'name': 'all-mpnet-base-v2', 'modality': 'text'},
}
TEXT_REPOS = {'minilm': 'sentence-transformers/all-MiniLM-L6-v2',
              'mpnet': 'sentence-transformers/all-mpnet-base-v2'}


class ComparisonItem(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    text: str = Field(default='', max_length=4000)
    image: str = Field(default='', max_length=400000)


class ComparisonRequest(BaseModel):
    model: str
    query: ComparisonItem
    candidates: list[ComparisonItem] = Field(min_length=1, max_length=30)
    relevant_ids: list[str] | None = None

    @model_validator(mode='after')
    def validate_inputs(self):
        if self.model not in MODELS:
            raise ValueError('Unknown comparison model')
        ids = [c.id for c in self.candidates]
        if len(ids) != len(set(ids)):
            raise ValueError('Candidate IDs must be unique')
        if self.relevant_ids is not None and not set(self.relevant_ids).issubset(ids):
            raise ValueError('Correct matches must be candidate IDs')
        field = 'text' if MODELS[self.model]['modality'] == 'text' else 'image'
        if any(not getattr(item, field).strip() for item in [self.query, *self.candidates]):
            raise ValueError(f'Every query and candidate needs {field}')
        return self


class ReportEmbeddingItem(ComparisonItem):
    image: str = Field(default='', max_length=4100000)


class ReportEmbeddingRequest(BaseModel):
    model: str
    items: list[ReportEmbeddingItem] = Field(min_length=1, max_length=8)

    @model_validator(mode='after')
    def validate_items(self):
        if self.model not in MODELS:
            raise ValueError('Unknown matching model')
        if len({item.id for item in self.items}) != len(self.items):
            raise ValueError('Report IDs must be unique')
        field = 'text' if MODELS[self.model]['modality'] == 'text' else 'image'
        if any(not getattr(item, field).strip() for item in self.items):
            raise ValueError(f'Every report needs {field}')
        return self


def decode_image(value):
    try:
        raw = base64.b64decode(value.split(',', 1)[-1], validate=True)
        with Image.open(io.BytesIO(raw)) as image:
            if image.width * image.height > 16_000_000:
                raise ValueError('Image is too large')
            return ImageOps.exif_transpose(image).convert('RGB')
    except (ValueError, UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(422, 'Upload a valid image under 16 megapixels') from exc


def create_comparison_router(get_clip, get_text_model, get_device, model_source):
    router = APIRouter(prefix='/comparison')
    # Retain only one alternative model to bound resident memory.
    alternative = {}
    inference_lock = threading.Lock()

    def encoder(key):
        device = get_device()
        if key == 'clip':
            model, processor = get_clip()
            def encode(values):
                inputs = processor(images=values, return_tensors='pt').to(device)
                pooled = model.vision_model(pixel_values=inputs['pixel_values']).pooler_output
                return F.normalize(model.visual_projection(pooled), dim=-1)
            return encode
        if key == 'e5':
            model = get_text_model()
            return lambda values: model.encode(['query: ' + text for text in values],
                normalize_embeddings=True, convert_to_tensor=True, show_progress_bar=False)
        if alternative.get('key') != key:
            alternative.clear()
            if device.type == 'cuda':
                torch.cuda.empty_cache()
            if key in TEXT_REPOS:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer(model_source(key, TEXT_REPOS[key]), device=str(device),
                    cache_folder=str(Path(__file__).parent / 'model-cache' / 'hub'))
                model.eval()
                alternative.update(key=key, model=model)
            else:
                from torchvision.models import (resnet50, ResNet50_Weights,
                    efficientnet_b0, EfficientNet_B0_Weights)
                builder, weights = ((resnet50, ResNet50_Weights.IMAGENET1K_V2)
                    if key == 'resnet50' else (efficientnet_b0, EfficientNet_B0_Weights.IMAGENET1K_V1))
                checkpoint = Path(__file__).parent / 'model-cache' / (key + '.pth')
                if os.environ.get('VERCEL') and not checkpoint.is_file():
                    raise RuntimeError('Comparison weights are not bundled; enable BUNDLE_COMPARISON_MODELS during the AI build')
                model = builder(weights=None)
                if not checkpoint.is_file():
                    checkpoint.parent.mkdir(parents=True, exist_ok=True)
                    state = torch.hub.load_state_dict_from_url(weights.url,
                        model_dir=str(checkpoint.parent), map_location='cpu', check_hash=True)
                    torch.save(state, checkpoint)
                else:
                    state = torch.load(checkpoint, map_location='cpu', weights_only=True)
                model.load_state_dict(state)
                if key == 'resnet50':
                    model.fc = torch.nn.Identity()
                else:
                    model.classifier = torch.nn.Identity()
                alternative.update(key=key, model=model.to(device).eval(), transform=weights.transforms())
        model = alternative['model']
        if key in TEXT_REPOS:
            return lambda values: model.encode(values, normalize_embeddings=True,
                convert_to_tensor=True, show_progress_bar=False)
        transform = alternative['transform']
        return lambda values: F.normalize(model(torch.stack([transform(im) for im in values]).to(device)), dim=-1)

    @router.get('/models')
    def models():
        return {'models': [{'id': key, **value} for key, value in MODELS.items()]}

    @router.post('/embeddings')
    def embed_reports(request: ReportEmbeddingRequest):
        modality = MODELS[request.model]['modality']
        inputs = ([item.text.strip() for item in request.items] if modality == 'text'
                  else [decode_image(item.image) for item in request.items])
        if modality == 'image':
            for image in inputs:
                image.thumbnail((512, 512))
        with inference_lock, torch.inference_mode():
            try:
                vectors = encoder(request.model)(inputs).detach().cpu().tolist()
            except Exception as exc:
                logging.getLogger(__name__).exception('Report model %s failed', request.model)
                raise HTTPException(503, f'{MODELS[request.model]["name"]} is unavailable. Check the AI service and installed model weights.') from exc
        return {'model': request.model, 'modality': modality,
                'items': [{'id': item.id, 'embedding': vector} for item, vector in zip(request.items, vectors)]}

    @router.post('/run')
    def run(request: ComparisonRequest):
        modality = MODELS[request.model]['modality']
        values = [request.query, *request.candidates]
        inputs = ([item.text.strip() for item in values] if modality == 'text'
                  else [decode_image(item.image) for item in values])
        with inference_lock, torch.inference_mode():
            try:
                encode = encoder(request.model)
                def sync():
                    if get_device().type == 'cuda':
                        torch.cuda.synchronize()
                sync()
                start = time.perf_counter()
                vectors = torch.cat([encode(inputs[i:i + 8]) for i in range(1, len(inputs), 8)])
                sync()
                index_ms = (time.perf_counter() - start) * 1000
                encode(inputs[:1])  # warm up, excluding model loading and indexing
                sync()
                start = time.perf_counter()
                scores = encode(inputs[:1]) @ vectors.T
                sync()
                elapsed = (time.perf_counter() - start) * 1000
                ranking = rank_scores([c.id for c in request.candidates], scores[0].cpu().tolist())
            except Exception as exc:
                logging.getLogger(__name__).exception('Comparison model %s failed', request.model)
                raise HTTPException(503, f'{MODELS[request.model]["name"]} could not load or run. Install the AI requirements and download its pretrained weights; check AI server logs for details.') from exc
        return {'model': request.model, 'name': MODELS[request.model]['name'], 'modality': modality,
                'ranking': ranking, 'metrics': summarize_ranking(ranking, request.relevant_ids, len(request.candidates)),
                'query_time_ms': elapsed, 'candidate_index_ms': index_ms,
                'candidate_count': len(request.candidates), 'device': str(get_device())}

    return router
