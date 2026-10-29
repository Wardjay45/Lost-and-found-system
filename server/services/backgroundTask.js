import { waitUntil } from '@vercel/functions';
export function backgroundTask(promise) {
  const handled = promise.catch(error => console.error('Background task failed:', error.message));
  if (process.env.VERCEL) waitUntil(handled);
  return handled;
}
