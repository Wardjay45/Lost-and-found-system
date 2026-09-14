"""
Lost & Found AI Server
Provides embedding generation for images (CLIP ViT-B/32) and text (E5-base-v2).
Runs on port 8000 alongside the Express.js server on port 3001.
"""
import base64
import io
import traceback
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import torch
from sentence_transformers import SentenceTransformer
from transformers import CLIPProcessor, CLIPModel

app = FastAPI(title="Lost & Found AI", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler for better error logging
from fastapi.responses import JSONResponse
from starlette.requests import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"\n❌ Unhandled error on {request.method} {request.url.path}:\n{tb}")
    return JSONResponse(status_code=500, content={"detail": str(exc)})

# Global model references (lazy loaded)
text_model = None
clip_model = None
clip_processor = None
device = None


def get_device():
    global device
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return device


def get_text_model():
    """Load E5-base-v2 for text embeddings (768-dim)"""
    global text_model
    if text_model is None:
        print("Loading E5-base-v2 text model...")
        text_model = SentenceTransformer("intfloat/e5-base-v2", device=get_device())
        print("E5-base-v2 loaded.")
    return text_model


def get_clip():
    """Load CLIP ViT-B/32 for image embeddings (512-dim)"""
    global clip_model, clip_processor
    if clip_model is None:
        print("Loading CLIP ViT-B/32 model...")
        dw = get_device()
        clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(dw)
        clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        clip_model.eval()
        print("CLIP ViT-B/32 loaded.")
    return clip_model, clip_processor


def extract_image_embedding(model, inputs):
    """
    Extract normalized image embedding from CLIP model output.
    Handles both old transformers (returns tensor) and new transformers 5.x
    (returns BaseModelOutputWithPooling).
    """
    with torch.no_grad():
        outputs = model.get_image_features(**inputs)
        # New transformers may return a dict-like object; extract the tensor
        if hasattr(outputs, 'pooler_output'):
            features = outputs.pooler_output
        elif hasattr(outputs, 'last_hidden_state'):
            features = outputs.last_hidden_state[:, 0, :]
        elif isinstance(outputs, torch.Tensor):
            features = outputs
        else:
            # Try to get image_embeds or fallback
            features = getattr(outputs, 'image_embeds', outputs)
        embedding = features.squeeze().cpu().numpy().astype(np.float64)
        embedding = embedding / (np.linalg.norm(embedding) + 1e-8)
    return embedding


# ── Request models ──────────────────────────────────────────────

class TextEmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text description to embed")


class ImageBase64Request(BaseModel):
    image: str = Field(..., min_length=1, description="Base64-encoded image (data:image/...;base64,...)")


class StoredItem(BaseModel):
    id: int | str
    image_embedding: list[float] | None = None
    text_embedding: list[float] | None = None


class CombinedSearchRequest(BaseModel):
    text: str = ""
    image_base64: str = ""
    stored_items: list[StoredItem] = []
    top_k: int = Field(5, ge=1, le=100)
    image_weight: float = Field(0.7, ge=0.0, le=1.0)
    text_weight: float = Field(0.3, ge=0.0, le=1.0)


# ── Response models ─────────────────────────────────────────────

class TextEmbeddingResponse(BaseModel):
    embedding: list[float]
    dimensions: int


class ImageEmbeddingResponse(BaseModel):
    embedding: list[float]
    dimensions: int


class MatchItem(BaseModel):
    index: int
    score: float


class MatchResponse(BaseModel):
    matches: list[MatchItem]


class MatchRequest(BaseModel):
    query_embedding: list[float]
    stored_embeddings: list[list[float]]
    top_k: int = 5


class CombinedMatchItem(BaseModel):
    id: int | str
    score: float
    image_score: float
    text_score: float


class CombinedSearchResponse(BaseModel):
    matches: list[CombinedMatchItem]


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "lost-and-found-ai"}


@app.post("/embedding/text", response_model=TextEmbeddingResponse)
def create_text_embedding(request: TextEmbeddingRequest):
    """
    Generate text embedding from a description using E5-base-v2.
    Input: { "text": "black wallet with leather material" }
    """
    model = get_text_model()
    # E5 models expect "query: " prefix for asymmetric tasks
    embedding = model.encode(f"query: {request.text}", normalize_embeddings=True)
    return {"embedding": embedding.tolist(), "dimensions": len(embedding)}


@app.post("/embedding/image", response_model=ImageEmbeddingResponse)
async def create_image_embedding(file: UploadFile = File(...)):
    """
    Generate image embedding from an uploaded image file using CLIP.
    Accepts multipart file upload.
    """
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    model, processor = get_clip()
    dw = get_device()

    inputs = processor(images=image, return_tensors="pt").to(dw)
    embedding = extract_image_embedding(model, inputs)

    return {"embedding": embedding.tolist(), "dimensions": len(embedding)}


@app.post("/embedding/image-base64", response_model=ImageEmbeddingResponse)
def create_image_embedding_base64(request: ImageBase64Request):
    """
    Generate image embedding from a base64-encoded image using CLIP.
    Input: { "image": "data:image/jpeg;base64,..." }
    """
    b64_data = request.image
    try:
        if "base64," in b64_data:
            b64_data = b64_data.split("base64,")[1]
        image_bytes = base64.b64decode(b64_data)
        print(f"  Image decoded: {len(image_bytes)} bytes")
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        print(f"  Image opened: {image.size}")
    except Exception as e:
        print(f"  ✗ Image decode error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")

    try:
        model, processor = get_clip()
        dw = get_device()

        inputs = processor(images=image, return_tensors="pt").to(dw)
        embedding = extract_image_embedding(model, inputs)

        print(f"  ✓ Image embedding: {len(embedding)} dims")
        return {"embedding": embedding.tolist(), "dimensions": len(embedding)}
    except Exception as e:
        print(f"  ✗ CLIP processing error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Image embedding failed: {str(e)}")


@app.post("/similarity", response_model=MatchResponse)
def compute_similarity(request: MatchRequest):
    """
    Compute cosine similarity between a query embedding and stored embeddings.
    Returns top-k indices and scores.
    """
    query = np.array(request.query_embedding)
    if len(request.stored_embeddings) == 0:
        return {"matches": []}

    stored = np.array(request.stored_embeddings)

    # Cosine similarity
    query_norm = query / (np.linalg.norm(query) + 1e-8)
    stored_norm = stored / (np.linalg.norm(stored, axis=1, keepdims=True) + 1e-8)
    scores = np.dot(stored_norm, query_norm)

    # Get top-k indices
    k = min(request.top_k, len(scores))
    top_indices = np.argsort(scores)[-k:][::-1]

    matches = [{"index": int(i), "score": float(scores[i])} for i in top_indices]
    return {"matches": matches}


@app.post("/combined-search", response_model=CombinedSearchResponse)
def combined_search(request: CombinedSearchRequest):
    """
    Generate both image and text embeddings and return combined results.
    Input: {
        "text": "optional description",
        "image_base64": "optional base64 image",
        "stored_items": [{ "id": 1, "image_embedding": [...], "text_embedding": [...] }, ...],
        "top_k": 5,
        "image_weight": 0.7,
        "text_weight": 0.3
    }
    """
    text = request.text
    image_b64 = request.image_base64
    stored_items = request.stored_items
    top_k = request.top_k
    img_weight = request.image_weight
    txt_weight = request.text_weight

    query_img_emb = None
    query_txt_emb = None

    # Generate query embeddings
    if image_b64:
        try:
            if "base64," in image_b64:
                raw = image_b64.split("base64,")[1]
            else:
                raw = image_b64
            image = Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGB")
            model, processor = get_clip()
            dw = get_device()
            inputs = processor(images=image, return_tensors="pt").to(dw)
            with torch.no_grad():
                query_img_emb = extract_image_embedding(model, inputs)
        except Exception as e:
            print(f"Image embedding failed: {e}")

    if text:
        try:
            tm = get_text_model()
            query_txt_emb = tm.encode(f"query: {text}", normalize_embeddings=True)
        except Exception as e:
            print(f"Text embedding failed: {e}")

    if query_img_emb is None and query_txt_emb is None:
        raise HTTPException(status_code=400, detail="Provide either text or image_base64")

    # Normalize weights if both embeddings are present, else single weight = 1.0
    has_img = query_img_emb is not None
    has_txt = query_txt_emb is not None
    if has_img and has_txt:
        total_w = img_weight + txt_weight
        img_w = img_weight / total_w if total_w > 0 else 0.5
        txt_w = txt_weight / total_w if total_w > 0 else 0.5
    elif has_img:
        img_w, txt_w = 1.0, 0.0
    else:
        img_w, txt_w = 0.0, 1.0

    # Score each stored item (skip dimension mismatches gracefully)
    results = []
    for item in stored_items:
        image_score = 0.0
        text_score = 0.0
        if has_img and item.image_embedding:
            try:
                s_img = np.array(item.image_embedding, dtype=np.float64)
                if len(s_img) != len(query_img_emb):
                    print(f"  [skip] item #{item.id}: image dim mismatch stored={len(s_img)} query={len(query_img_emb)}")
                else:
                    s_img = s_img / (np.linalg.norm(s_img) + 1e-8)
                    image_score = float(np.dot(s_img, query_img_emb))
            except Exception as e:
                print(f"  [warn] item #{item.id} image scoring failed: {e}")
        if has_txt and item.text_embedding:
            try:
                s_txt = np.array(item.text_embedding, dtype=np.float64)
                if len(s_txt) != len(query_txt_emb):
                    print(f"  [skip] item #{item.id}: text dim mismatch stored={len(s_txt)} query={len(query_txt_emb)}")
                else:
                    s_txt = s_txt / (np.linalg.norm(s_txt) + 1e-8)
                    text_score = float(np.dot(s_txt, query_txt_emb))
            except Exception as e:
                print(f"  [warn] item #{item.id} text scoring failed: {e}")

        combined_score = img_w * image_score + txt_w * text_score
        results.append(CombinedMatchItem(
            id=item.id,
            score=combined_score,
            image_score=image_score,
            text_score=text_score,
        ))

    # Sort by score descending
    results.sort(key=lambda x: x.score, reverse=True)
    return {"matches": results[:top_k]}


if __name__ == "__main__":
    import uvicorn
    # Increase h11's max incomplete event size for large base64 image payloads
    try:
        import h11
        h11._readers.DEFAULT_MAX_INCOMPLETE_EVENT_SIZE = 50 * 1024 * 1024  # 50MB
    except (ImportError, AttributeError):
        pass

    # Use httptools if available (faster, no buffer limits), otherwise h11
    http_impl = "auto"
    try:
        import httptools  # noqa: F401
        http_impl = "httptools"
        print("Using httptools HTTP implementation")
    except ImportError:
        print("Using h11 HTTP implementation (install httptools for better performance)")

    uvicorn.run(app, host="0.0.0.0", port=8000, http=http_impl)