"""Bundle public model weights during deployment, never during a cold request."""
from pathlib import Path
import os
from huggingface_hub import snapshot_download
from matching_scores import IMAGE_MODEL, TEXT_MODEL

root = Path(__file__).resolve().parent / "model-cache"
patterns = ["config.json", "model.safetensors", "pytorch_model.bin", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt", "vocab.json", "merges.txt", "preprocessor_config.json", "sentence_bert_config.json", "modules.json", "1_Pooling/config.json", "2_Normalize/config.json", "config_sentence_transformers.json"]
models = [("text", TEXT_MODEL), ("image", IMAGE_MODEL)]
if os.environ.get('BUNDLE_COMPARISON_MODELS') == '1':
    models += [('minilm', 'sentence-transformers/all-MiniLM-L6-v2'),
               ('mpnet', 'sentence-transformers/all-mpnet-base-v2')]
for name, repo in models:
    # Prefer safetensors when available; do not bundle duplicate model formats.
    from huggingface_hub import list_repo_files
    available = list_repo_files(repo)
    selected = [p for p in patterns if p in available and not (p == "pytorch_model.bin" and "model.safetensors" in available)]
    snapshot_download(repo_id=repo, local_dir=root / name, allow_patterns=selected)
    print("Bundled", repo)

if os.environ.get('BUNDLE_COMPARISON_MODELS') == '1':
    import torch
    from torchvision.models import ResNet50_Weights, EfficientNet_B0_Weights
    for name, weights in [('resnet50', ResNet50_Weights.IMAGENET1K_V2),
                          ('efficientnet-b0', EfficientNet_B0_Weights.IMAGENET1K_V1)]:
        torch.save(weights.get_state_dict(progress=True, check_hash=True), root / (name + '.pth'))
        print('Bundled', name)
