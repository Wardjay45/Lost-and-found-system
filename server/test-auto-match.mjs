// Test the auto-match endpoint
const res = await fetch('http://localhost:3001/api/ai/auto-match', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});
const data = await res.json();

console.log(`Status: ${res.status}`);
console.log(`Lost items: ${data.lost_count}, Found items: ${data.found_count}`);
console.log(`Total matches: ${data.matches?.length || 0}\n`);

if (data.matches && data.matches.length > 0) {
  data.matches.slice(0, 5).forEach(m => {
    console.log(
      `  ${(m.score * 100).toFixed(1)}% | ` +
      `Image:${(m.image_score * 100).toFixed(0)}% | ` +
      `Text:${(m.text_score * 100).toFixed(0)}% | ` +
      `"${(m.lost_item?.description || '').substring(0, 30)}" → "${(m.found_item?.description || '').substring(0, 30)}"`
    );
  });
}

if (data.error) console.log('ERROR:', data.error);
if (data.message) console.log('MESSAGE:', data.message);