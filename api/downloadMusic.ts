import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
    try {
        // Convert Vercel format to our format
        const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/downloadMusic'}`;
        const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const response = await handleRequest(request);
        if (!response) {
            throw new Error('handleRequest returned undefined');
        }

        // For binary responses, we need to handle differently
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('audio/')) {
            const buffer = await response.arrayBuffer();
            const disposition = response.headers.get('content-disposition');
            
            res.set({
                'Content-Type': contentType,
                'Content-Length': buffer.byteLength.toString(),
                'Content-Disposition': disposition || 'attachment; filename="music.wav"'
            });
            
            res.status(response.status).send(Buffer.from(buffer));
        } else {
            const data = await response.text();
            res.status(response.status).json(JSON.parse(data));
        }
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}

export async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        console.log('downloadMusic: Starting request processing');
        const body = await request.json();
        console.log('downloadMusic: Body parsed:', JSON.stringify(body));

        const { audioContent, fileName, mimeType = 'audio/wav' } = body;

        if (!audioContent) {
            return new Response(JSON.stringify({ 
                error: 'audioContent is required. Please provide base64-encoded audio data.' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Decode base64 audio content
        let audioBuffer: Buffer;
        try {
            audioBuffer = Buffer.from(audioContent, 'base64');
        } catch (error) {
            return new Response(JSON.stringify({ 
                error: 'Invalid base64 audio content' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Determine file extension based on MIME type
        let fileExtension = '.wav';
        if (mimeType.includes('mp3')) {
            fileExtension = '.mp3';
        } else if (mimeType.includes('ogg')) {
            fileExtension = '.ogg';
        } else if (mimeType.includes('flac')) {
            fileExtension = '.flac';
        }

        const finalFileName = fileName || `generated-music-${Date.now()}${fileExtension}`;

        return new Response(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Content-Length': audioBuffer.byteLength.toString(),
                'Content-Disposition': `attachment; filename="${finalFileName}"`,
            },
        });

    } catch (error) {
        console.error('downloadMusic error:', error);
        return new Response(JSON.stringify({
            error: `Music download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
