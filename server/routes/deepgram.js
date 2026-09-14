import { Router } from 'express';

const router = Router();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen?model=nova-3&language=en&smart_format=true';

/**
 * Detect audio MIME type from the first bytes of the buffer.
 * Expo Audio.Recording produces different formats per platform:
 *   - iOS:     M4A (AAC in MP4 container) — starts with 'ftyp'
 *   - Android: 3GP or MPEG/AAC
 *   - WebM:    WebM container
 */
function detectAudioMime(buffer) {
  if (!buffer || buffer.length < 12) return 'audio/webm'; // safe default for Deepgram

  // Check for MP4/M4A container (iOS) — 'ftyp' at offset 4
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return 'audio/mp4';
  }

  // Check for WAV — 'RIFF' header
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'audio/wav';
  }

  // Check for WebM/MKV — EBML header (0x1A 0x45 0xDF 0xA3)
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return 'audio/webm';
  }

  // Check for OGG — 'OggS'
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return 'audio/ogg';
  }

  // Check for MPEG/MP3 — frame sync (0xFF 0xFB or 0xFF 0xF3 or 0xFF 0xE3)
  if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    return 'audio/mpeg';
  }

  // Check for 3GP container — 'ftyp3gp'
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70 &&
      buffer[8] === 0x33 && buffer[9] === 0x67 && buffer[10] === 0x70) {
    return 'audio/3gpp';
  }

  // Default — let Deepgram try to auto-detect
  return 'audio/webm';
}

/**
 * GET /api/speech-to-text — Health check (test connectivity from mobile)
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'speech-to-text',
    hasApiKey: !!DEEPGRAM_API_KEY,
    model: 'nova-3',
  });
});

/**
 * POST /api/speech-to-text
 * Receives base64-encoded audio from mobile app (JSON body), sends to Deepgram.
 * Body: { audio: "<base64 string>" }
 */
router.post('/', async (req, res) => {
  console.log(`🎤 Incoming speech-to-text request (body size: ${JSON.stringify(req.body || {}).length} bytes)`);
  try {
    // Validate API key is configured
    if (!DEEPGRAM_API_KEY) {
      console.error('❌ DEEPGRAM_API_KEY is not set in .env');
      return res.status(500).json({ error: 'Speech-to-text not configured (missing API key)' });
    }

    const { audio } = req.body || {};

    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'No audio provided. Send { audio: "<base64>" }' });
    }

    // Strip data URI prefix if present (e.g., "data:audio/wav;base64,...")
    const base64Data = audio.includes(',') ? audio.split(',')[1] : audio;

    const audioBuffer = Buffer.from(base64Data, 'base64');

    if (audioBuffer.length < 100) {
      return res.status(400).json({ error: 'Audio data too small — recording may have failed' });
    }

    const mimeType = detectAudioMime(audioBuffer);
    console.log(`🎤 Speech-to-text: ${(audioBuffer.length / 1024).toFixed(1)}KB, detected format: ${mimeType}`);

    const response = await fetch(DEEPGRAM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': mimeType,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Deepgram API error:', response.status, errText);
      return res.status(response.status).json({
        error: 'Speech-to-text failed',
        detail: errText,
      });
    }

    const result = await response.json();

    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    if (!transcript) {
      console.log('⚠️ Deepgram returned empty transcript (no speech detected)');
      return res.json({
        success: true,
        transcript: '',
        confidence: 0,
        message: 'No speech detected. Try speaking louder or closer to the mic.',
      });
    }

    console.log(`✅ Transcribed: "${transcript.substring(0, 80)}${transcript.length > 80 ? '...' : ''}" (confidence: ${(confidence * 100).toFixed(1)}%)`);

    res.json({
      success: true,
      transcript: transcript.trim(),
      confidence,
    });
  } catch (err) {
    console.error('❌ Speech-to-text error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
