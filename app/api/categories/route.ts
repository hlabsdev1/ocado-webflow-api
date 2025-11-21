import { NextResponse } from 'next/server';
import { AUTH_TOKEN, CATEGORY_COLLECTION_ID } from '../../../config';

export async function GET() {
  try {
    // Fetch category items from Webflow
    const response = await fetch(`https://api.webflow.com/v2/collections/${CATEGORY_COLLECTION_ID}/items`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'accept-version': '2.0.0'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch categories from Webflow API');
    }

    const data = await response.json();
    return NextResponse.json({ items: data.items || [] });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch categories from Webflow' },
      { status: 500 }
    );
  }
} 