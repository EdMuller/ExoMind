import express from 'express';
import { createServer as createViteServer } from 'vite';
import fetch from 'node-fetch'; // We can use native fetch in Node 18+, but let's just use global fetch

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voiceId } = req.body;
      const apiKey = process.env.ELEVENLABS_SECRET_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: 'ELEVENLABS_SECRET_KEY is not configured on the server.' });
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('ElevenLabs API error:', errText);
        return res.status(response.status).json({ error: 'Failed to generate audio with ElevenLabs' });
      }

      // Pipe the audio response back to the client
      res.setHeader('Content-Type', 'audio/mpeg');
      
      // Node 18+ native fetch response body is a ReadableStream, we can pipe it
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);

    } catch (error) {
      console.error('TTS Server Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
