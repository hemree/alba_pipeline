// Server-side endpoint for polling video generation operations

export default async function handler(req: any, res: any) {
    try {
        // Convert Vercel format to our format
        const url = req.url?.startsWith('http') ? req.url : `http://localhost:3001${req.url || '/api/pollOperation'}`;
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
        const { operationName } = await request.json();

        if (!operationName) {
            return new Response(JSON.stringify({ error: 'Operation name is required.' }), {
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

        // Call Google Cloud Operations API to poll the operation status
        const response = await fetch(
            `https://aiplatform.googleapis.com/v1/${operationName}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Operation polling error:', errorText);
            return new Response(JSON.stringify({
                error: `Operation polling failed: ${response.status} ${response.statusText}`,
                details: errorText
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const operation = await response.json();

        return new Response(JSON.stringify(operation), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error("Poll operation error:", error);
        const message = error instanceof Error ? error.message : "Poll operation failed";
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
