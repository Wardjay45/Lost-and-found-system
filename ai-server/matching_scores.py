"""Shared scoring for the API and offline study evaluation. No model or database I/O."""
import math

IMAGE_MODEL = "openai/clip-vit-base-patch32"
TEXT_MODEL = "intfloat/e5-base-v2"


def score_candidates(query_image, query_text, candidates, image_weight=.7, text_weight=.3, top_k=10):
    # Query embeddings are already normalized by CLIP/E5. Preserve the API's
    # stored-vector normalization, missing-vector zero scores and weight fallback.
    has_image, has_text = query_image is not None, query_text is not None
    if not has_image and not has_text:
        raise ValueError("Missing query modality: supply a usable description or image")
    if has_image and has_text:
        total = image_weight + text_weight
        iw, tw = (image_weight / total, text_weight / total) if total else (.5, .5)
    else:
        iw, tw = (1., 0.) if has_image else (0., 1.)

    def similarity(query, stored):
        if query is None or stored is None or len(stored) != len(query) or not len(stored):
            return 0.
        try:
            norm = math.sqrt(sum(float(v) ** 2 for v in stored)) + 1e-8
            result = sum(float(a) * float(b) / norm for a, b in zip(query, stored))
            return result if math.isfinite(result) else 0.
        except (TypeError, ValueError, OverflowError):
            return 0.

    results = []
    for item in candidates:
        image_score = similarity(query_image, item.get("image_embedding"))
        text_score = similarity(query_text, item.get("text_embedding"))
        results.append({"id": item["id"], "score": iw * image_score + tw * text_score,
                        "image_score": image_score, "text_score": text_score})
    return sorted(results, key=lambda item: item["score"], reverse=True)[:top_k]
