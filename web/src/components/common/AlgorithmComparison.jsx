const MODELS = {
  image: [
    { id: 'clip', name: 'CLIP ViT-B/32', explanation: 'Vision Transformer image features with cosine similarity.' },
    { id: 'resnet50', name: 'ResNet50', explanation: 'Residual CNN image features with cosine similarity.' },
    { id: 'efficientnet-b0', name: 'EfficientNet-B0', explanation: 'Compact CNN image features with cosine similarity.' },
  ],
  text: [
    { id: 'e5', name: 'E5-base-v2', explanation: 'Transformer text embeddings with cosine similarity.' },
    { id: 'minilm', name: 'all-MiniLM-L6-v2', explanation: 'Compact Transformer text embeddings with cosine similarity.' },
    { id: 'mpnet', name: 'all-mpnet-base-v2', explanation: 'Transformer sentence embeddings with cosine similarity.' },
  ],
};

export default function AlgorithmComparison({ model, onModelChange }) {
  const mode = MODELS.image.some(item => item.id === model) ? 'image' : 'text';
  const models = MODELS[mode];
  const selected = models.find(item => item.id === model);

  function tabKeys(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % models.length;
    if (event.key === 'ArrowLeft') next = (index + models.length - 1) % models.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = models.length - 1;
    if (next == null) return;
    event.preventDefault(); onModelChange(models[next].id);
    document.getElementById(`model-tab-${models[next].id}`)?.focus();
  }

  return <section className="ui-panel p-5 mb-6" aria-label="Matching models">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><h2 className="font-semibold">Matching models</h2><p className="text-sm text-gray-500 mt-1">Choose a model to view suggested matches from existing reports.</p></div>
      <div role="group" aria-label="Matching type" className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1">
        {['image', 'text'].map(type => <button key={type} type="button" className={`ui-button ${mode === type ? 'ui-button-primary' : ''}`} aria-pressed={mode === type} onClick={() => onModelChange(MODELS[type][0].id)}>{type === 'image' ? 'Image matching' : 'Text matching'}</button>)}
      </div>
    </div>
    <div role="tablist" aria-label={`${mode} models`} className="flex flex-wrap gap-2 mt-4 border-b border-gray-200 dark:border-gray-700 pb-3">
      {models.map((item, index) => <button type="button" role="tab" key={item.id} id={`model-tab-${item.id}`} aria-selected={model === item.id} aria-controls="model-match-results" tabIndex={model === item.id ? 0 : -1} onKeyDown={event => tabKeys(event, index)} onClick={() => onModelChange(item.id)} className={`ui-button ${model === item.id ? 'ui-button-primary' : 'ui-button-secondary'}`}>{item.name}</button>)}
    </div>
    <p className="text-sm text-gray-500 mt-3"><strong className="text-gray-900 dark:text-white">{selected.name}</strong> / {selected.explanation}</p>
  </section>;
}
