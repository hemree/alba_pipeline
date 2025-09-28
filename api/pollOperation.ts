// Server-side endpoint for polling video generation operations
import { GoogleAuth } from 'google-auth-library';

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

        // Store status before consuming the body
        const statusCode = response.status;
        const data = await response.text();

        try {
            const jsonData = JSON.parse(data);
            res.status(statusCode).json(jsonData);
        } catch (parseError) {
            res.status(statusCode).send(data);
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
        const { operationName } = await request.json();

        if (!operationName) {
            return new Response(JSON.stringify({ error: 'Operation name is required.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get OAuth2 access token
        async function getAccessToken(): Promise<string> {
            try {
                const auth = new GoogleAuth({
                    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });

                const client = await auth.getClient();
                const accessToken = await client.getAccessToken();

                if (!accessToken.token) {
                    throw new Error('Failed to obtain access token');
                }

                return accessToken.token;
            } catch (error) {
                console.error('Error getting access token:', error);
                throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        const accessToken = await getAccessToken();
        console.log('Successfully obtained OAuth2 access token for operation polling');

        // Call Google Cloud Operations API to poll the operation status
        const response = await fetch(
            `https://aiplatform.googleapis.com/v1/${operationName}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
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
