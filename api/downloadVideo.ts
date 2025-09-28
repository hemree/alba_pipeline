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

        // For binary responses, we need to handle differently
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('video/')) {
            const buffer = await response.arrayBuffer();
            const disposition = response.headers.get('content-disposition');

            res.set({
                'Content-Type': contentType,
                'Content-Length': buffer.byteLength.toString(),
                'Content-Disposition': disposition || 'attachment; filename="video.mp4"'
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

async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const body = await request.json();
        const { videoFile, fileName, videoUri } = body;

        // Support different parameter formats
        let targetFileName = fileName;
        let targetUri = videoUri;

        if (videoFile?.name) {
            targetFileName = videoFile.name;
        }
        if (videoFile?.uri) {
            targetUri = videoFile.uri;
        }

        if (!targetFileName && !targetUri) {
            return new Response(JSON.stringify({ error: 'fileName, videoUri, or videoFile is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get Google Cloud credentials
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Google API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // If we have a Google Cloud Storage URI, download from there
        if (targetUri && targetUri.startsWith('gs://')) {
            try {
                // Convert gs:// URI to HTTP URL for download
                const httpUrl = targetUri.replace('gs://', 'https://storage.googleapis.com/');

                const response = await fetch(httpUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
                }

                const videoData = await response.arrayBuffer();

                return new Response(videoData, {
                    status: 200,
                    headers: {
                        'Content-Type': 'video/mp4',
                        'Content-Length': videoData.byteLength.toString(),
                        'Content-Disposition': `attachment; filename="${targetFileName || 'generated-video.mp4'}"`,
                    },
                });
            } catch (error) {
                console.error('Video download error:', error);
                return new Response(JSON.stringify({
                    error: `Video download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // If no URI provided, return error
        return new Response(JSON.stringify({
            error: 'Video URI is required for download. Please provide videoUri or videoFile.uri.'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
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
