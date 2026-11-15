import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from comparison_metrics import rank_scores, summarize_ranking
from model_comparison import create_comparison_router
import torch


class FakeTextModel:
    def encode(self, values, **kwargs):
        # Deterministic encoder double: verifies wiring, not real model quality.
        return torch.tensor([[1., 0.] if 'wallet' in text else [0., 1.] for text in values])


class ComparisonTests(unittest.TestCase):
    def test_metrics_and_ties(self):
        ranked = rank_scores(['a', 'b', 'c', 'd', 'e', 'f'], [.9, .8, .8, .4, .3, .2])
        self.assertEqual([r['id'] for r in ranked][:3], ['a', 'b', 'c'])
        metrics = summarize_ranking(ranked, ['b', 'f'], 6)
        self.assertEqual(metrics, {'hit_rate_1': 0., 'hit_rate_5': 1., 'mrr': .5,
                                  'precision_5': .2, 'recall_5': .5})
        self.assertIsNone(summarize_ranking(ranked, None, 6))
        self.assertIsNone(summarize_ranking(ranked, [], 6))
        self.assertIsNone(summarize_ranking(ranked[:2], ['b'], 2)['precision_5'])

    def setUp(self):
        app = FastAPI()
        app.include_router(create_comparison_router(lambda: None, lambda: FakeTextModel(),
                           lambda: torch.device('cpu'), lambda name, fallback: fallback))
        self.client = TestClient(app)
        self.payload = {'model': 'e5', 'query': {'id': 'q', 'text': 'lost wallet'},
                        'candidates': [{'id': 'a', 'text': 'cup'}, {'id': 'b', 'text': 'wallet'}],
                        'relevant_ids': ['b']}

    def test_labeled_and_unlabeled_query(self):
        response = self.client.post('/comparison/run', json=self.payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['ranking'][0]['id'], 'b')
        self.assertEqual(response.json()['metrics']['hit_rate_1'], 1.)
        self.payload.pop('relevant_ids')
        self.assertIsNone(self.client.post('/comparison/run', json=self.payload).json()['metrics'])

    def test_validation(self):
        self.payload['relevant_ids'] = ['unknown']
        self.assertEqual(self.client.post('/comparison/run', json=self.payload).status_code, 422)
        self.payload['relevant_ids'] = None
        self.payload['model'] = 'not-a-model'
        self.assertEqual(self.client.post('/comparison/run', json=self.payload).status_code, 422)
        self.payload['model'] = 'clip'
        self.assertEqual(self.client.post('/comparison/run', json=self.payload).status_code, 422)

    def test_catalog(self):
        models = self.client.get('/comparison/models').json()['models']
        self.assertEqual(sum(m['modality'] == 'image' for m in models), 3)
        self.assertEqual(sum(m['modality'] == 'text' for m in models), 3)

    def test_report_embeddings_preserve_identity_and_validate_input(self):
        response = self.client.post('/comparison/embeddings', json={'model': 'e5', 'items': [
            {'id': 'lost:1', 'text': 'wallet'}, {'id': 'found:1', 'text': 'cup'}]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['items'], [
            {'id': 'lost:1', 'embedding': [1., 0.]}, {'id': 'found:1', 'embedding': [0., 1.]}])
        self.assertEqual(self.client.post('/comparison/embeddings', json={
            'model': 'clip', 'items': [{'id': 'a', 'text': 'not an image'}]}).status_code, 422)


if __name__ == '__main__':
    unittest.main()
