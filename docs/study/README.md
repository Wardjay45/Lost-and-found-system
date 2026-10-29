# Study evaluation procedure

These tools prepare evidence; they do not establish that the study objectives have already been achieved. Speech-to-text is deferred. Populate official campus locations through the admin Locations page. Never insert synthetic reports, handovers or ratings into the live database for evaluation.

## 1. Agree the protocol before collecting final results

Record adviser-approved sample sizes, recruitment/consent, success targets, query/candidate selection, matching threshold, weights, missing-data treatment, device/hardware, and manual comparison procedure. Keep these fixed for the final test. A similarity percentage is not accuracy or proof of ownership. Owner satisfaction is separate from matching accuracy.

Use an anonymized study directory outside tracked source for photographs and completed records. Do not include names, school IDs, contact information or faces. Check photos for identifying details before including them. Keep the original consented data under the study's approved access controls. No tool exports production data automatically.

## 2. Matching dataset

Copy `dataset.template.json` into the dataset directory. Fill `candidates` with found reports and `queries` with lost reports. Use unique anonymized string IDs. A candidate is:

```json
{"id":"c-001","description":"Blue fabric bag with a square patch","image_path":"images/c-001.jpg"}
```

A query is:

```json
{"id":"q-001","description":"Blue bag with a patch","image_path":"images/q-001.jpg","relevant_ids":["c-001"],"split":"test","tags":["color","texture","viewing-angle"]}
```

`image_path` and `description` are optional individually; use both for multimodal cases. Image paths must stay inside the dataset folder. `relevant_ids` must be independently verified candidate IDs; use `[]` only for a verified no-match query. Never derive truth from AI scores or an unverified suggested match.

Use separate `tuning` and `test` queries. Put all photographs of the same physical item in one split. The validator rejects relevant candidate IDs shared across splits; reviewers must also check different IDs do not hide the same item. Keep the candidate pool and tie order fixed. Include distractors and verified unmatched items.

Supported tags are `color`, `shape`, `texture`, `lighting`, `viewing-angle`, and `similar-item`. Collect real examples for each condition and document how conditions were selected. Group results evaluate CLIP's learned representations; they do not claim separate handcrafted color, shape or texture extraction. Groups can overlap and are not independent studies.

## 3. Run offline matching evaluation

Install the AI server's existing requirements and provision the exact CLIP/E5 model weights in the local Hugging Face cache before an offline run. The runner forces offline model loading and never calls Supabase, Express, or the network. Missing files/models appear as failures, not fabricated matches.

From `ai-server`, using the threshold chosen in the protocol (0.70 below is only a command example):

```powershell
python evaluate.py C:/study/dataset.json --output C:/study/results-test --threshold 0.70 --split test
```

Defaults remain 70% image / 30% text. Optional `--image-weight` and `--text-weight` are recorded. Use the tuning split for changes; do not tune from final-test results. Missing query modalities fall back to the available modality in combined mode. Single-modality runs without their required input fail visibly. Missing or dimension-mismatched candidate vectors receive zero for that modality, matching the API.

Outputs are `results.json`, `queries.csv`, and `summary.md`. They include package/model identifiers and available cached revisions, manifest/image hashes, weights, threshold, coverage/failures, and visual-condition groups. Record unresolved model revisions manually before publishing results. Exit 1 means query/embedding failures were recorded and must be reviewed; exit 2 means input/setup validation failed. Do not discard failed queries to improve a score.

- Top-1/top-5 accuracy: fraction of queries with a verified match whose first/first-five ranked candidates include one. Failed positive queries remain in the denominator. Unmatched queries have no valid top-k accuracy denominator.
- Precision/recall: micro-averaged across the threshold-selected top-10 results, including false positives from unmatched queries. Undefined ratios display N/A.
- Median/p95 latency: warm local query embedding plus ranking. Candidate preparation and warmup are recorded separately. This excludes HTTP/database/network delay and actual recovery time; measure those separately in device trials. Record sample counts and hardware.

The API currently considers at most 500 candidates, with 10 recommendations for search and five per lost report for admin automatic matching. This offline runner ranks the supplied pool and reports 10 recommendations. Match pool size and recommendation cutoff to the flow being evaluated, and state any differences. Results for a larger offline pool do not prove production coverage beyond those limits.

Software smoke test only:

```powershell
python evaluate.py ../docs/study/synthetic-fixture.json --synthetic-fixture --output C:/study/software-check --threshold 0.70
```

Precomputed vectors are accepted by the CLI only with `synthetic: true` and `--synthetic-fixture`. Their outputs carry **SYNTHETIC FIXTURE — NOT STUDY RESULTS**. These vectors and their visual tags test calculations, not vision performance.

## 4. Recovery trials

Fill `recovery-trials.template.csv` with anonymized trials. `method` is `manual` or `system-assisted`; `setting` is `controlled` or `live`. Keep controlled scenarios identifiable and outside live handover tables. `case_group_id` links comparable difficulty groups without repeating a scenario to the same participant and creating a learning advantage. Document the allocation/order procedure.

Use timezone-qualified ISO timestamps. `reported_at` starts the report-to-recovery duration; `search_started_at` and `search_finished_at` measure task/search time separately. `recovered_at` requires a verified handover. `outcome` is `recovered` or `not_recovered`; `verified` is `true` or `false`. Leave recovery timestamps empty for unsuccessful trials. Record the observation period, incomplete follow-ups and failures; never replace them with zero-duration successes.

Compare verified recovery proportions and median/average duration by method and setting. Report denominators, unresolved cases and uncertainty. Compare like-for-like scenarios and observation windows. Existing Feedback → recovery metrics measures live confirmed handovers; it is not a manual baseline, matching-accuracy calculation or controlled-trial log.

## 5. Accessibility and location acceptance

Use `accessibility-checks.template.csv`. On an actual Android device, test reporting lost/found, browsing, matching, profile and settings with TalkBack, all text sizes, light/dark/high-contrast themes, large touch targets and reduced motion. Verify reading order, required field labels, selected states, errors, photo controls, keyboard access, long descriptions and persistence after a restart. Check OS font scaling as well as app scaling. Verify TTS separately; speech-to-text is postponed.

Use protanopia, deuteranopia, tritanopia and achromatopsia simulations to review the same tasks. Confirm labels, numbers and check marks communicate meaning without color. Simulation/palette checks are supporting evidence, not a substitute for actual users or TalkBack testing. Keep simulated/browser checks and device checks in separate rows.

In an isolated test environment, add a temporary location, select it in both apps, deactivate it, refresh and confirm new submissions reject it; reactivate and confirm it returns. Existing reports must retain their original location and additional information. Do not deactivate AB BUILDING or alter real reports for a test. Add only actual administrator-approved campus areas through the admin page.

## 6. Forecast interpretation

Forecasts use up to six completed months in campus time (UTC+8), excluding the current and initial recorded months. At least three complete months are required. Next calendar month is two steps after the last complete training month; five or more complete months permit backtests using that same horizon and only earlier training months. MAE is measured in reports and is shown with the evaluated-month count, not as an accuracy percentage. Three months is a display guard, not a statistical reliability guarantee.

Zero-report months are included only within the assumed observation period inferred from first recorded activity. Document outages, deleted/imported history and periods without tracking; inferred coverage cannot establish data completeness. Do not create historical reports to unlock predictions. With the current short history, “Insufficient reporting history” is expected.
