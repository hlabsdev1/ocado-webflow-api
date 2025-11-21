import { NextResponse } from 'next/server';
import { AUTH_TOKEN, COLLECTION_ID } from '../../../config';

// GET endpoint to verify collection and count items
export async function GET() {
  try {
    console.log(`🔍 Verifying collection: ${COLLECTION_ID}`);
    
    // Fetch collection info
    const collectionResponse = await fetch(
      `https://api.webflow.com/v2/collections/${COLLECTION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'accept-version': '2.0.0',
        },
      }
    );

    if (!collectionResponse.ok) {
      const errorText = await collectionResponse.text().catch(() => 'Unknown error');
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch collection: ${collectionResponse.status}`,
          details: errorText.substring(0, 500),
        },
        { status: collectionResponse.status }
      );
    }

    const collectionData = await collectionResponse.json();
    const collectionName = collectionData.displayName || collectionData.name || 'Unknown';
    const fields = collectionData.fields || [];
    
    // Fetch all items
    const itemsResponse = await fetch(
      `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'accept-version': '2.0.0',
        },
      }
    );

    let items: any[] = [];
    let itemsError = null;
    
    if (itemsResponse.ok) {
      try {
        const itemsData = await itemsResponse.json();
        items = itemsData.items || [];
      } catch (e) {
        itemsError = 'Failed to parse items response';
      }
    } else {
      itemsError = `Failed to fetch items: ${itemsResponse.status}`;
    }

    // Count items by status
    const draftItems = items.filter((item: any) => item.isDraft === true);
    const liveItems = items.filter((item: any) => item.isDraft === false);
    const archivedItems = items.filter((item: any) => item.isArchived === true);

    return NextResponse.json({
      success: true,
      collection: {
        id: COLLECTION_ID,
        name: collectionName,
        fieldCount: fields.length,
        fields: fields.map((f: any) => ({
          slug: f.slug,
          name: f.displayName || f.name,
          type: f.type,
        })),
      },
      items: {
        total: items.length,
        drafts: draftItems.length,
        live: liveItems.length,
        archived: archivedItems.length,
        sample: items.slice(0, 5).map((item: any) => ({
          id: item.id,
          name: item.fieldData?.name || 'Unnamed',
          isDraft: item.isDraft,
          isArchived: item.isArchived,
        })),
      },
      error: itemsError,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify collection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

