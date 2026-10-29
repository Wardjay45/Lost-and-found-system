import { useState } from 'react';
import AppIcon from './AppIcon';
import StatusBadge from './StatusBadge';
import Modal from './Modal';
import ItemDescription from './ItemDescription';
import { formatDate } from '../../utils/formatters';

function scorePercent(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value * 100))) : null;
}

function ReportCard({ item, kind, onPreview }) {
  const [failedImage, setFailedImage] = useState(null);
  const lost = kind === 'lost';
  const photo = item?.image && item.image !== failedImage;
  return <article className={`match-report match-report-${kind}`} aria-label={lost ? 'Lost item report' : 'Found item report'}>
    <header className="match-report-header"><span><AppIcon name={lost ? 'search' : 'box'} />{lost ? 'Lost item' : 'Found item'}</span>{item?.status && <StatusBadge status={item.status} />}</header>
    <div className="match-photo">
      {photo ? <button type="button" onClick={() => onPreview({ src: item.image, label: `${lost ? 'Lost' : 'Found'} item photo` })} aria-label={`Enlarge ${kind} item photo`}>
        <img src={item.image} alt={`${lost ? 'Lost' : 'Found'} item: ${item.description || 'Reported item'}`} onError={() => setFailedImage(item.image)} />
        <span className="match-photo-action"><AppIcon name="image" />Enlarge photo</span>
      </button> : <div className="match-photo-empty"><AppIcon name="image" /><span>{item?.image ? 'Photo unavailable' : 'No photo provided'}</span></div>}
    </div>
    <div className="match-report-body">
      <p className="match-report-id">{item?.item_id || 'Report ID unavailable'}</p>
      <ItemDescription description={item?.description} />
      <dl className="match-report-fields">
        <div><dt>Category</dt><dd>{item?.category_name || 'Not provided'}</dd></div>
        <div><dt>{lost ? 'Date reported' : 'Date found'}</dt><dd>{formatDate(lost ? item?.date_reported : item?.date_found || item?.date_reported)}</dd></div>
        <div className="match-report-location"><dt>{lost ? 'Location lost' : 'Location found'}</dt><dd>{item?.location || item?.location_lost || item?.location_found || 'Not provided'}</dd></div>
        <div className="match-report-additional"><dt>Additional Info</dt><dd>{item?.location_details?.trim() || 'No additional information provided.'}</dd></div>
        <div><dt>{lost ? 'Reported by' : 'Found by'}</dt><dd>{(lost ? item?.reporter_name : item?.finder_name || item?.reporter_name) || 'Not provided'}</dd></div>
        {!lost && <div><dt>Condition</dt><dd>{item?.condition || 'Not provided'}</dd></div>}
      </dl>
    </div>
  </article>;
}

export default function MatchComparison({ match }) {
  const [preview, setPreview] = useState(null);
  const combined = scorePercent(match.score);
  const bothScores = match.image_score > 0 && match.text_score > 0;
  return <div className="match-comparison">
    <div className="match-summary"><div><h3>Compare reports</h3><p>Review the photos, locations, and additional information.</p></div><span className="match-similarity">{combined === null ? 'Score unavailable' : `${combined}% similarity`}</span></div>
    <div className="match-report-grid"><ReportCard kind="lost" item={match.lost_item} onPreview={setPreview} /><ReportCard kind="found" item={match.found_item} onPreview={setPreview} /></div>
    <section className="match-score-panel" aria-label="Similarity breakdown">
      <h3>Similarity breakdown</h3>
      <div className="match-score-grid">{[['Combined', match.score], ['Image similarity', match.image_score], ['Text similarity', match.text_score]].map(([label, score]) => {
        const percent = scorePercent(score);
        return <div className="match-score" key={label}><div><span>{label}</span><strong>{percent === null ? 'Unavailable' : `${percent}%`}</strong></div>
          {percent !== null && <div className="match-score-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>}
        </div>;
      })}</div>
      <p>{bothScores ? 'Combined score uses 70% image similarity and 30% text similarity.' : match.image_score > 0 ? 'Combined score uses the available image comparison.' : match.text_score > 0 ? 'Combined score uses the available text comparison.' : 'Similarity scores are shown when comparison data is available.'}</p>
    </section>
    <Modal isOpen={!!preview} onClose={() => setPreview(null)} title={preview?.label || 'Item photo'} size="xl"><img className="image-preview" src={preview?.src} alt={preview?.label || 'Item photo'} /></Modal>
  </div>;
}
