import { NextRequest, NextResponse } from 'next/server';
import { AUTH_TOKEN, SITE_ID, IMGBB_API_KEY } from '../../../config';
import crypto from 'crypto';

// Use simple image hosting instead of complex Webflow Assets
const USE_SIMPLE_IMAGE_HOST = true;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('=== Image Upload Started ===');
    console.log('File name:', file.name);
    console.log('File type:', file.type);
    console.log('File size:', file.size);
    console.log('Using simple image hosting:', USE_SIMPLE_IMAGE_HOST);
    
    // Use simple image hosting (ImgBB) - works immediately!
    if (USE_SIMPLE_IMAGE_HOST) {
      return await uploadToImgBB(file);
    }
    
    // Otherwise use complex Webflow Assets API (has URL timing issues)
    return await uploadToWebflowAssets(file);
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function uploadToImgBB(file: File) {
  try {
    console.log('📤 Uploading to ImgBB...');
    console.log('Using API key:', IMGBB_API_KEY ? '✅ Configured' : '❌ Missing');
    
    if (!IMGBB_API_KEY) {
      throw new Error('ImgBB API key is not configured');
    }
    
    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    
    // Upload to ImgBB
    const uploadFormData = new FormData();
    uploadFormData.append('image', base64);
    uploadFormData.append('name', file.name);
    
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      {
        method: 'POST',
        body: uploadFormData,
      }
    );
    
    console.log('ImgBB response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ImgBB upload failed:', errorText);
      throw new Error(`Failed to upload to ImgBB: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ ImgBB upload successful!');
    console.log('Image URL:', data.data.url);
    
    // Return in the same format expected by the frontend
    // Since we're using plain URL, we can generate a fake fileId
    const responseData = {
      fileId: data.data.id || crypto.randomBytes(12).toString('hex'),
      url: data.data.url,
      alt: file.name.replace(/\.[^/.]+$/, '')
    };
    
    console.log('Returning:', responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('❌ ImgBB upload error:', error);
    throw error;
  }
}

async function uploadToWebflowAssets(file: File) {
  try {
    console.log('=== Webflow Asset Upload Started ===');
    console.log('File name:', file.name);
    console.log('File type:', file.type);
    console.log('File size:', file.size);

    // Validate file size (Webflow max is 4MB)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { 
          error: 'File too large',
          details: 'Webflow requires images to be under 4MB'
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate MD5 hash
    const hash = crypto.createHash('md5');
    hash.update(buffer);
    const fileHash = hash.digest('hex');
    console.log('File hash:', fileHash);

    // Step 1: Create asset metadata and get upload URL
    console.log('Step 1: Creating asset metadata...');
    const createAssetUrl = `https://api.webflow.com/v2/sites/${SITE_ID}/assets`;
    
    const createResponse = await fetch(createAssetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileHash: fileHash,
        variants: []
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Create asset error:', errorText);
      
      return NextResponse.json(
        { 
          error: 'Failed to create asset in Webflow',
          details: errorText
        },
        { status: createResponse.status }
      );
    }

    const assetData = await createResponse.json();
    console.log('=== Asset metadata created ===');
    console.log('Full asset data:', JSON.stringify(assetData, null, 2));
    console.log('Asset ID:', assetData.id);
    console.log('Asset URL:', assetData.url);
    console.log('Asset publicUrl:', assetData.publicUrl);
    console.log('Asset createdOn:', assetData.createdOn);
    console.log('Asset fileName:', assetData.fileName);
    console.log('Asset fileSize:', assetData.fileSize);
    console.log('Asset mimeType:', assetData.mimeType);
    console.log('All asset properties:', Object.keys(assetData));
    
    // Check for any URL-like fields
    const allFields = Object.entries(assetData);
    console.log('Checking all fields for URLs:');
    allFields.forEach(([key, value]) => {
      if (typeof value === 'string' && (value.includes('http') || value.includes('webflow'))) {
        console.log(`  ${key}: ${value}`);
      }
    });

    // Step 2: Upload file to the provided URL
    console.log('Step 2: Uploading file to presigned URL...');
    const uploadUrl = assetData.uploadUrl;
    const uploadDetails = assetData.uploadDetails;

    if (!uploadUrl) {
      return NextResponse.json(
        { 
          error: 'No upload URL provided',
          details: 'Webflow did not return an upload URL'
        },
        { status: 500 }
      );
    }

    // Create multipart form data for S3 upload
    const uploadFormData = new FormData();
    
    // Add all the fields from uploadDetails
    if (uploadDetails && typeof uploadDetails === 'object') {
      Object.entries(uploadDetails).forEach(([key, value]) => {
        uploadFormData.append(key, value as string);
      });
    }
    
    // Add the file last
    uploadFormData.append('file', new Blob([buffer], { type: file.type }), file.name);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('File upload error:', errorText);
      
      return NextResponse.json(
        { 
          error: 'Failed to upload file',
          details: errorText
        },
        { status: uploadResponse.status }
      );
    }

    console.log('✅ File uploaded successfully to S3!');
    
    // Step 3: Wait a moment for Webflow to process the asset
    console.log('Step 3: Waiting 2 seconds for Webflow to process asset...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Fetch the asset to get the final URL
    console.log('Step 4: Fetching asset details to get final URL...');
    const getAssetUrl = `https://api.webflow.com/v2/sites/${SITE_ID}/assets/${assetData.id}`;
    
    const getAssetResponse = await fetch(getAssetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'accept': 'application/json',
      },
    });
    
    if (!getAssetResponse.ok) {
      console.error('Failed to fetch asset details:', await getAssetResponse.text());
      // Fall back to initial data
      console.log('Falling back to initial asset data');
    } else {
      const finalAssetData = await getAssetResponse.json();
      console.log('Final asset data after fetch:', JSON.stringify(finalAssetData, null, 2));
      // Update assetData with the fetched data
      Object.assign(assetData, finalAssetData);
    }
    
    console.log('Final asset URL:', assetData.url);
    console.log('Final asset publicUrl:', assetData.publicUrl);
    console.log('Final asset ID:', assetData.id);
    
    // Try multiple possible URL fields
    const imageUrl = assetData.url || 
                     assetData.publicUrl || 
                     assetData.cdnUrl ||
                     assetData.s3Url ||
                     assetData.location;
    
    console.log('Resolved image URL:', imageUrl);
    
    if (!imageUrl) {
      console.error('❌ No URL found in asset data!');
      console.error('Available fields:', Object.keys(assetData));
      console.error('Full asset object:', JSON.stringify(assetData, null, 2));
      
      // Return the asset data so we can see what's available
      return NextResponse.json(
        { 
          error: 'No URL returned from Webflow',
          details: 'Asset was created but no URL was found in the response. Please check server logs for available fields.',
          assetData: assetData,
          availableFields: Object.keys(assetData)
        },
        { status: 500 }
      );
    }
    
    // Return the image object in the format Webflow CMS expects
    // Webflow expects: { fileId, url, alt (optional) }
    const responseData = {
      fileId: assetData.id,
      url: imageUrl,
      alt: file.name.replace(/\.[^/.]+$/, '') // Use filename without extension as alt text
    };
    console.log('Returning to client:', JSON.stringify(responseData, null, 2));
    console.log('=== Webflow Asset Upload Finished ===');
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('❌ Error uploading to Webflow Assets:', error);
    throw error;
  }
}
