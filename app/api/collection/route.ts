import { NextResponse } from 'next/server';
import { AUTH_TOKEN, COLLECTION_ID } from '../../../config';

export async function GET() {
  try {
    const collectionResponse = await fetch(`https://api.webflow.com/v2/collections/${COLLECTION_ID}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'accept-version': '2.0.0'
      }
    });

    const itemsResponse = await fetch(`https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'accept-version': '2.0.0'
      }
    });

    if (!collectionResponse.ok) {
      throw new Error(`Failed to fetch collection metadata: ${collectionResponse.status}`);
    }

    if (!itemsResponse.ok) {
      throw new Error(`Failed to fetch collection items: ${itemsResponse.status}`);
    }

    const collectionData = await collectionResponse.json();
    const itemsData = await itemsResponse.json();

    return NextResponse.json({
      collection: collectionData,
      items: itemsData.items || []
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch collection data from Webflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 