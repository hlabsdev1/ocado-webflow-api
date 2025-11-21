import { NextResponse } from 'next/server';
import { AUTH_TOKEN, LOCATION_COLLECTION_ID } from '../../../config';

export async function GET() {
  try {
    const response = await fetch(`https://api.webflow.com/v2/collections/${LOCATION_COLLECTION_ID}/items`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'accept-version': '2.0.0'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch locations from Webflow API');
    }

    const data = await response.json();
    return NextResponse.json({ items: data.items || [] });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

