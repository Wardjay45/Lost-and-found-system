"""Retrieval metrics for a single labeled query; independent of ML dependencies."""
import math


def summarize_ranking(ranking, relevant_ids, candidate_count):
    if relevant_ids is None:
        return None
    relevant = set(relevant_ids)
    if not relevant:
        # A ranked retrieval result cannot evaluate rejection without a threshold.
        return None
    ranks = [i for i, row in enumerate(ranking, 1) if row['id'] in relevant]
    first = ranks[0]
    hits = sum(rank <= 5 for rank in ranks)
    return {'hit_rate_1': float(first == 1), 'hit_rate_5': float(first <= 5),
            'mrr': 1 / first, 'precision_5': hits / 5 if candidate_count >= 5 else None,
            'recall_5': hits / len(relevant)}


def rank_scores(ids, scores):
    if len(ids) != len(scores) or not all(math.isfinite(float(x)) for x in scores):
        raise ValueError('Invalid model scores')
    return sorted([{'id': key, 'score': max(-1., min(1., float(score)))}
                   for key, score in zip(ids, scores)], key=lambda row: row['score'], reverse=True)
