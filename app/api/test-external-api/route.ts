import { NextResponse } from 'next/server';

const EXTERNAL_API_URL = 'https://ocado-jobs-proxy.himanshuchawla569.workers.dev/?format=json';

// Test endpoint to check if external API is accessible
export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(EXTERNAL_API_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const status = response.status;
    const statusText = response.statusText;
    const headers = Object.fromEntries(response.headers.entries());
    
    let body;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        body = await response.json();
      } catch (e) {
        body = await response.text();
      }
    } else {
      body = await response.text();
    }
    
    return NextResponse.json({
      success: response.ok,
      status,
      statusText,
      headers,
      body: typeof body === 'string' ? body.substring(0, 1000) : body, // Limit body size
      bodyType: typeof body,
      isArray: Array.isArray(body),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.name === 'AbortError' ? 'Request timeout' : error.message,
      errorType: error.name,
      stack: error.stack,
    }, { status: 500 });
  }
}

