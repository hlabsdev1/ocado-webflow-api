import { NextResponse } from 'next/server';
import { AUTH_TOKEN, COLLECTION_ID } from '../../../../../config';

interface RouteParams {
  params: Promise<{
    itemId: string;
  }>;
}

export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    
    // Always use staging endpoint - users can only update staging items
    // Prepare the request body for Webflow API
    const webflowBody: any = {
      fieldData: body.fieldData,
      isArchived: typeof body.isArchived === 'boolean' ? body.isArchived : false,
      isDraft: true // Always keep as draft
    };

    // Always use staging endpoint
    const endpoint = `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/${resolvedParams.itemId}`;

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'accept-version': '2.0.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webflowBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      
      return NextResponse.json(
        { 
          error: 'Failed to update item',
          details: errorData,
          status: response.status
        },
        { status: response.status }
      );
    }

    const updatedItem = await response.json();
    return NextResponse.json(updatedItem);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update collection item' },
      { status: 500 }
    );
  }
} 