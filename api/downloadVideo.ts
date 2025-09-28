// Server-side endpoint for downloading generated videos

export default async function handler(req: any, res: any) {
    try {
        // Convert Vercel format to our format
        const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/downloadVideo'}`;
        const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const response = await handleRequest(request);
        if (!response) {
            throw new Error('handleRequest returned undefined');
        }

        const data = await response.text();
        res.status(response.status).json(JSON.parse(data));
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}

async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { videoFile } = await request.json();

        // Use new Google GenAI SDK for downloading
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        // Use direct API call instead of SDK for file download
        const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${videoFile.name}?alt=media&key=${apiKey}`;

        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        return new Response(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': arrayBuffer.byteLength.toString(),
            },
        });

    } catch (error) {
        console.error("Download video error:", error);
        const message = error instanceof Error ? error.message : "Video download failed";
        return new Response(JSON.stringify({
            error: message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
