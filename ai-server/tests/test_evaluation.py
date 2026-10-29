import math
import random
import json
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest
from matching_scores import score_candidates
from evaluate import summarize, validate_manifest, run_benchmark


class ScoringTests(unittest.TestCase):
    def test_combination_matches_existing_weights_and_missing_modality_rules(self):
        rows = [{"id": "a", "image_embedding": [1, 0], "text_embedding": [0, 1]},
                {"id": "b", "image_embedding": [0, 1], "text_embedding": [1, 0]}]
        combined = score_candidates([1, 0], [1, 0], rows)
        self.assertEqual(combined[0]["id"], "a")
        self.assertAlmostEqual(combined[0]["score"], .7, places=7)
        self.assertEqual(score_candidates(None, [1, 0], rows)[0]["id"], "b")
        self.assertEqual(score_candidates([1, 0], None, rows)[0]["id"], "a")
        self.assertEqual(score_candidates([1, 0], None, [{"id": "m", "image_embedding": [1]}])[0]["score"], 0)
        with self.assertRaises(ValueError):
            score_candidates(None, None, rows)

    def test_metrics_include_false_positives_unmatched_queries_and_failed_positive_queries(self):
        rows = [
            {"relevant_ids": ["a"], "matches": [{"id": "a", "score": .9}, {"id": "b", "score": .8}], "latency_ms": 10},
            {"relevant_ids": [], "matches": [{"id": "b", "score": .8}], "latency_ms": 20},
            {"relevant_ids": ["c"], "matches": [], "latency_ms": None, "error": "Missing query modality"},
        ]
        metrics = summarize(rows, .7)
        self.assertEqual(metrics["top1_accuracy"], .5)
        self.assertEqual(metrics["top5_accuracy"], .5)
        self.assertAlmostEqual(metrics["precision"], 1 / 3)
        self.assertEqual(metrics["recall"], .5)
        self.assertEqual(metrics["failures"], 1)
        self.assertEqual(metrics["median_latency_ms"], 15)
        self.assertEqual(metrics["p95_latency_ms"], 20)
        self.assertIsNone(summarize([], .7)["precision"])

    def test_manifest_rejects_unknown_truth_duplicate_ids_and_invalid_splits(self):
        data = {"dataset_id": "fixture", "synthetic": True, "candidates": [{"id": "a"}], "queries": [{"id": "q", "split": "test", "relevant_ids": ["a"]}]}
        validate_manifest(data)
        data["queries"][0]["relevant_ids"] = ["unknown"]
        with self.assertRaises(ValueError): validate_manifest(data)

        data["queries"][0]["relevant_ids"] = []
        data["queries"][0]["split"] = "maybe"
        with self.assertRaises(ValueError): validate_manifest(data)
        data["queries"][0]["split"] = "test"
        data["candidates"].append({"id": "a"})
        with self.assertRaises(ValueError): validate_manifest(data)

    def test_cli_marks_fixture_outputs_and_rejects_fixture_vectors_as_real_evidence(self):
        script = Path(__file__).resolve().parents[1] / 'evaluate.py'
        fixture = script.parent.parent / 'docs/study/synthetic-fixture.json'
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'results'
            args = [sys.executable, str(script), str(fixture), '--synthetic-fixture', '--output', str(output), '--threshold', '0.7']
            completed = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertTrue(json.loads((output / 'results.json').read_text())['synthetic'])
            self.assertIn('NOT STUDY RESULTS', (output / 'summary.md').read_text(encoding='utf-8'))
            self.assertTrue((output / 'queries.csv').is_file())
            data = json.loads(fixture.read_text()); data['synthetic'] = False
            false_evidence = Path(directory) / 'false.json'; false_evidence.write_text(json.dumps(data))
            args[2] = str(false_evidence)
            rejected = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(rejected.returncode, 2)
            self.assertIn('cannot be used as study evidence', rejected.stderr)

    def test_benchmark_keeps_splits_modes_tags_and_failures_visible(self):
        data = {"dataset_id": "synthetic-unit-fixture", "synthetic": True,
                "candidates": [{"id": "a", "image_embedding": [1, 0], "text_embedding": [1, 0]}, {"id": "b", "image_embedding": [0, 1], "text_embedding": [0, 1]}],
                "queries": [{"id": "q", "split": "test", "relevant_ids": ["a"], "tags": ["color"], "text_embedding": [1, 0]},
                            {"id": "tuning", "split": "tuning", "relevant_ids": ["b"], "text_embedding": [1, 0]}]}
        result = run_benchmark(data, lambda item, modality: item.get(modality + "_embedding"), threshold=.7)
        self.assertTrue(result["synthetic"])
        self.assertEqual(result["query_count"], 1)
        self.assertEqual(result["modes"]["image"]["metrics"]["failures"], 1)
        self.assertEqual(result["modes"]["combined"]["metrics"]["top1_accuracy"], 1)
        self.assertEqual(result["modes"]["combined"]["groups"]["color"]["queries"], 1)
        self.assertEqual(result["modes"]["combined"]["coverage"]["queries_missing_image"], 1)

    def test_shared_scorer_preserves_previous_numpy_scores(self):
        import numpy as np
        random.seed(42)
        image = np.array([random.random() for _ in range(512)]); image /= np.linalg.norm(image) + 1e-8
        text = np.array([random.random() for _ in range(768)]); text /= np.linalg.norm(text)
        candidate = {"id": "a", "image_embedding": [random.random() for _ in range(512)], "text_embedding": [random.random() for _ in range(768)]}
        expected = .7 * float(np.dot(np.array(candidate["image_embedding"]) / (np.linalg.norm(candidate["image_embedding"]) + 1e-8), image)) + .3 * float(np.dot(np.array(candidate["text_embedding"]) / (np.linalg.norm(candidate["text_embedding"]) + 1e-8), text))
        self.assertAlmostEqual(score_candidates(image, text, [candidate])[0]["score"], expected, places=12)

    def test_api_uses_shared_scorer_without_loading_models_or_changing_response_shape(self):
        import main
        import numpy as np
        from unittest.mock import patch
        class Model:
            def encode(self, *_args, **_kwargs): return np.array([1., 0.])
        with patch.object(main, "get_text_model", return_value=Model()):
            response = main.combined_search(main.CombinedSearchRequest(text="bag", stored_items=[main.StoredItem(id="a", text_embedding=[1., 0.])]))
        self.assertEqual(set(response), {"matches"})
        self.assertEqual(set(response["matches"][0].model_dump()), {"id", "score", "image_score", "text_score"})
        self.assertAlmostEqual(response["matches"][0].score, 1., places=7)


if __name__ == '__main__':
    unittest.main()
