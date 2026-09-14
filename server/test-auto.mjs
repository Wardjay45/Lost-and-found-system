const res = await fetch('http://localhost:3001/api/ai/auto-match', { method: 'POST' });
const d = await res.json();
console.log('Status:', res.status);
console.log('Lost:', d.lost_count, 'Found:', d.found_count, 'Matches:', d.matches?.length);
if (d.matches?.length) {
  d.matches.slice(0, 5).forEach(m => {
    const s = Math.round(m.score * 100);
    const img = Math.round(m.image_score * 100);
    const txt = Math.round(m.text_score * 100);
    console.log(`  ${s}% [Img:${img}% Txt:${txt}%] ${m.lost_item?.description?.substring(0,25)} -> ${m.found_item?.description?.substring(0,25)}`);
  });
}
if (d.error) console.log('ERROR:', d.error);