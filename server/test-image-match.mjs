// Test image match with a real image file
import { readFileSync } from 'fs';

const imagePath = 'e:/Lost and found-admin/Logo/Lost and found icon app.png';
const imageB64 = readFileSync(imagePath).toString('base64');

const body = JSON.stringify({
  item_type: 'lost',
  description: 'white tumbler',
  image_base64: `data:image/png;base64,${imageB64}`,
});

console.log(`Sending request - image_base64 length: ${body.length} chars`);

const res = await fetch('http://localhost:3001/api/ai/match', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});

const data = await res.json();
console.log(`\nMatches: ${data.matches?.length || 0}`);
if (data.matches && data.matches.length > 0) {
  data.matches.slice(0, 3).forEach(m => {
    console.log(
      `  ID:${m.id} | Score:${(m.score * 100).toFixed(0)}% | ` +
      `Image:${(m.image_score * 100).toFixed(0)}% | ` +
      `Text:${(m.text_score * 100).toFixed(0)}% | ` +
      `Desc: ${(m.description || '').substring(0, 40)}`
    );
  });
}