"""Offline matching benchmark. Reads local study files; never accesses Supabase."""
import argparse
import csv
import importlib.metadata
import json
import math
import os
import platform
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from matching_scores import IMAGE_MODEL, TEXT_MODEL, score_candidates

MODES = {"image": (True, False), "text": (False, True), "combined": (True, True)}
TAGS = ("color", "shape", "texture", "lighting", "viewing-angle", "similar-item")


def validate_manifest(data):
    if not isinstance(data, dict) or not isinstance(data.get("dataset_id"), str) or not data["dataset_id"].strip():
        raise ValueError("Provide an anonymized dataset_id")
    if not isinstance(data.get("synthetic"), bool):
        raise ValueError("Explicitly set synthetic to true or false")
    ids = {}
    for collection in ("candidates", "queries"):
        rows = data.get(collection)
        if not isinstance(rows, list) or not rows:
            raise ValueError(f"Provide at least one {collection} record")
        keys = [row.get("id") for row in rows]
        if any(not isinstance(key, str) or not key.strip() for key in keys) or len(set(keys)) != len(keys):
            raise ValueError(f"Use unique nonempty string IDs in {collection}")
        ids[collection] = set(keys)
        for row in rows:
            if "description" in row and not isinstance(row["description"], str):
                raise ValueError("Descriptions must be strings")
            if "image_path" in row and not isinstance(row["image_path"], str):
                raise ValueError("Image paths must be strings")
    for query in data["queries"]:
        truth = query.get("relevant_ids")
        if not isinstance(truth, list) or any(not isinstance(key, str) for key in truth) or not set(truth) <= ids["candidates"] or len(set(truth)) != len(truth):
            raise ValueError("Every query needs verified relevant_ids (an empty list means no match)")
        if query.get("split") not in ("tuning", "test"):
            raise ValueError("Query split must be tuning or test")
        if not isinstance(query.get("tags", []), list) or any(tag not in TAGS for tag in query.get("tags", [])):
            raise ValueError(f"Tags must come from {TAGS}")
    tuning_truth = {key for query in data["queries"] if query["split"] == "tuning" for key in query["relevant_ids"]}
    test_truth = {key for query in data["queries"] if query["split"] == "test" for key in query["relevant_ids"]}
    if tuning_truth & test_truth:
        raise ValueError("The same verified item cannot appear in both tuning and test queries")


def summarize(rows, threshold):
    positive = [row for row in rows if row["relevant_ids"]]
    true_positive = predicted = truth_count = 0
    top1 = top5 = 0
    for row in rows:
        truth = set(row["relevant_ids"])
        ranked = [match["id"] for match in row["matches"]]
        selected = {match["id"] for match in row["matches"] if match["score"] >= threshold}
        true_positive += len(truth & selected)
        predicted += len(selected)
        truth_count += len(truth)
        top1 += bool(truth & set(ranked[:1]))
        top5 += bool(truth & set(ranked[:5]))
    latencies = sorted(row["latency_ms"] for row in rows if row.get("latency_ms") is not None)
    return {"queries": len(rows), "positive_queries": len(positive), "unmatched_queries": len(rows) - len(positive),
            "top1_accuracy": top1 / len(positive) if positive else None,
            "top5_accuracy": top5 / len(positive) if positive else None,
            "precision": true_positive / predicted if predicted else None,
            "recall": true_positive / truth_count if truth_count else None,
            "true_positives": true_positive, "false_positives": predicted - true_positive,
            "false_negatives": truth_count - true_positive,
            "failures": sum(bool(row.get("error")) for row in rows),
            "median_latency_ms": statistics.median(latencies) if latencies else None,
            "p95_latency_ms": latencies[max(0, math.ceil(len(latencies) * .95) - 1)] if latencies else None,
            "latency_samples": len(latencies)}


def run_benchmark(data, embed, *, threshold, split="test", image_weight=.7, text_weight=.3):
    validate_manifest(data)
    if not 0 <= threshold <= 1 or not 0 <= image_weight <= 1 or not 0 <= text_weight <= 1:
        raise ValueError("Threshold and weights must be between 0 and 1")
    queries = [query for query in data["queries"] if query["split"] == split]
    if not queries:
        raise ValueError(f"No queries in the {split} split")
    failures = []

    def safe_embed(item, modality, stage):
        try:
            vector = embed(item, modality)
            if vector is not None and (not len(vector) or any(not math.isfinite(float(v)) for v in vector) or not any(vector)):
                raise ValueError("Embedding must be a finite nonzero vector")
            return vector
        except Exception as error:
            failures.append({"stage": stage, "id": item["id"], "modality": modality, "error": str(error)})
            return None

    start = time.perf_counter()
    candidates = [{"id": item["id"], **{f"{modality}_embedding": safe_embed(item, modality, "candidate") for modality in ("image", "text")}} for item in data["candidates"]]
    preparation_ms = (time.perf_counter() - start) * 1000
    # Warm the models before measuring query latency; capture cold/preparation
    # separately. Each measured mode embeds its query again, like a real request.
    warm_start = time.perf_counter()
    for modality in ("image", "text"):
        sample = next((query for query in queries if query.get("image_path" if modality == "image" else "description") or query.get(modality + "_embedding")), None)
        if sample: safe_embed(sample, modality, "warmup")
    warmup_ms = (time.perf_counter() - warm_start) * 1000
    modes = {}
    for mode, (use_image, use_text) in MODES.items():
        rows = []
        missing_image = missing_text = 0
        mismatches = []
        for query in queries:
            start = time.perf_counter()
            image = safe_embed(query, "image", mode) if use_image else None
            text = safe_embed(query, "text", mode) if use_text else None
            missing_image += use_image and image is None
            missing_text += use_text and text is None
            row = {"id": query["id"], "tags": query.get("tags", []), "relevant_ids": query["relevant_ids"], "matches": [], "latency_ms": None}
            for modality, vector in (("image", image), ("text", text)):
                if vector is not None:
                    for candidate in candidates:
                        stored = candidate.get(modality + "_embedding")
                        if stored is not None and len(stored) != len(vector):
                            mismatches.append({"query_id": query["id"], "candidate_id": candidate["id"], "modality": modality})
            try:
                row["matches"] = score_candidates(image, text, candidates, image_weight, text_weight, top_k=10)
                row["latency_ms"] = (time.perf_counter() - start) * 1000
            except ValueError as error:
                row["error"] = str(error)
            rows.append(row)
        modes[mode] = {"metrics": summarize(rows, threshold), "queries": rows,
                       "groups": {tag: summarize([row for row in rows if tag in row["tags"]], threshold) for tag in TAGS},
                       "coverage": {"queries_missing_image": missing_image, "queries_missing_text": missing_text,
                                    "candidates_missing_image": sum(item["image_embedding"] is None for item in candidates),
                                    "candidates_missing_text": sum(item["text_embedding"] is None for item in candidates),
                                    "dimension_mismatches": mismatches}}
    return {"dataset_id": data["dataset_id"], "synthetic": data["synthetic"], "split": split, "query_count": len(queries),
            "candidate_count": len(candidates), "threshold": threshold, "top_k": 10,
            "weights": {"image": image_weight, "text": text_weight},
            "models": {"image": IMAGE_MODEL, "text": TEXT_MODEL}, "created_at": datetime.now(timezone.utc).isoformat(),
            "preparation_ms": preparation_ms, "warmup_ms": warmup_ms,
            "embedding_failures": failures, "modes": modes,
            "latency_scope": "Warm local query embedding plus candidate ranking; excludes candidate preparation, HTTP, database, and real recovery time."}


def raw_embedder(root):
    # Lazy import: fixture/metric tests never download models or start servers.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    from main import get_text_model, get_clip, get_device, extract_image_embedding
    from PIL import Image

    def embed(item, modality):
        if modality == "text":
            text = item.get("description", "").strip()
            return get_text_model().encode(f"query: {text}", normalize_embeddings=True).tolist() if text else None
        if not item.get("image_path"): return None
        path = (root / item["image_path"]).resolve()
        if not path.is_relative_to(root.resolve()):
            raise ValueError("Images must be inside the dataset directory")
        model, processor = get_clip()
        with Image.open(path) as source:
            inputs = processor(images=source.convert("RGB"), return_tensors="pt").to(get_device())
            return extract_image_embedding(model, inputs).tolist()
    def revisions():
        import main as models
        image = getattr(getattr(models.clip_model, 'config', None), '_commit_hash', None)
        text = None
        if models.text_model is not None:
            text = getattr(getattr(models.text_model._first_module().auto_model, 'config', None), '_commit_hash', None)
        return {"image": image, "text": text}
    embed.revisions = revisions
    return embed


def write_results(result, output):
    output.mkdir(parents=True, exist_ok=True)
    (output / "results.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    label = "SYNTHETIC FIXTURE — NOT STUDY RESULTS" if result["synthetic"] else "Matching evaluation"
    lines = [f"# {label}", "", f"Dataset: {result['dataset_id']} | Split: {result['split']} | Queries: {result['query_count']} | Candidates: {result['candidate_count']}",
             f"Threshold: {result['threshold']} | Weights: {result['weights']} | Top-k: 10", "", result["latency_scope"], "",
             "| Mode | Top-1 | Top-5 | Precision | Recall | Median ms | P95 ms | Failed queries |", "|---|---|---|---|---|---|---|---|"]
    def show(value): return "N/A" if value is None else f"{value:.4f}"
    for mode, detail in result["modes"].items():
        metrics = detail["metrics"]
        lines.append("| " + " | ".join([mode] + [show(metrics[key]) for key in ("top1_accuracy", "top5_accuracy", "precision", "recall", "median_latency_ms", "p95_latency_ms")] + [str(metrics["failures"])]) + " |")
    lines += ["", f"Embedding failures: {len(result['embedding_failures'])}. See results.json for visual-condition groups, missing modalities and dimension mismatches.",
              "Top-k accuracy uses queries with a known match. Failed positive queries remain in its denominator. Precision/recall are micro-averaged across threshold-selected top-10 results, including unmatched queries. N/A means no denominator.",
              "Weights normalize when both query modalities exist; single-modality queries use the available modality. Missing candidate embeddings score zero, matching the API. Similarity is not accuracy or ownership confidence."]
    (output / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    with (output / "queries.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["synthetic", "mode", "query_id", "relevant_ids", "ranked_ids", "latency_ms", "error"])
        for mode, detail in result["modes"].items():
            for query in detail["queries"]:
                writer.writerow([result["synthetic"], mode, query["id"], json.dumps(query["relevant_ids"]), json.dumps([m["id"] for m in query["matches"]]), query["latency_ms"], query.get("error", "")])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--threshold", type=float, required=True, help="Set before final evaluation, between 0 and 1")
    parser.add_argument("--split", choices=("tuning", "test"), default="test")
    parser.add_argument("--image-weight", type=float, default=.7)
    parser.add_argument("--text-weight", type=float, default=.3)
    parser.add_argument("--synthetic-fixture", action="store_true", help="Use precomputed vectors only for a synthetic software fixture")
    args = parser.parse_args()
    try:
        data = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
        validate_manifest(data)
        if args.synthetic_fixture and not data["synthetic"]:
            raise ValueError("Precomputed fixture vectors cannot be used as study evidence")
        embed = (lambda item, modality: item.get(modality + "_embedding")) if args.synthetic_fixture else raw_embedder(args.manifest.parent)
        result = run_benchmark(data, embed, threshold=args.threshold, split=args.split, image_weight=args.image_weight, text_weight=args.text_weight)
        result["manifest_sha256"] = __import__('hashlib').sha256(args.manifest.read_bytes()).hexdigest()
        result["runtime"] = {"python": platform.python_version(), "platform": platform.platform()}
        result["packages"] = {}
        for package in ("torch", "transformers", "sentence-transformers", "numpy", "pillow"):
            try: result["packages"][package] = importlib.metadata.version(package)
            except importlib.metadata.PackageNotFoundError: result["packages"][package] = None
        result["embedding_source"] = "synthetic precomputed vectors" if args.synthetic_fixture else "local CLIP/E5 models"
        result["model_revisions"] = embed.revisions() if hasattr(embed, 'revisions') else {"image": None, "text": None}
        result["image_sha256"] = {}
        for collection in ('candidates', 'queries'):
            for item in data[collection]:
                if not item.get('image_path'): continue
                path = (args.manifest.parent / item['image_path']).resolve()
                if path.is_relative_to(args.manifest.parent.resolve()) and path.is_file():
                    result["image_sha256"][f"{collection}/{item['id']}"] = __import__('hashlib').sha256(path.read_bytes()).hexdigest()
        write_results(result, args.output)
        print(f"{'SYNTHETIC FIXTURE ONLY: ' if data['synthetic'] else ''}Results saved to {args.output}")
        if result["embedding_failures"] or any(detail["metrics"]["failures"] for detail in result["modes"].values()): return 1
        return 0
    except (ValueError, OSError, ImportError) as error:
        parser.exit(2, f"Evaluation unavailable: {error}\n")


if __name__ == "__main__":
    raise SystemExit(main())
