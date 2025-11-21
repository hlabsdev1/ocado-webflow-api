import { NextResponse } from 'next/server';
import { AUTH_TOKEN, COLLECTION_ID, LOCATION_COLLECTION_ID, SITE_ID } from '../../../config';

const EXTERNAL_API_URL = 'https://mocki.io/v1/72b913b5-7a7b-4a6e-a0be-18c78b240f43';


// Function to extract all unique fields from API data
function extractAllFieldsFromApiData(jobs: any[]): { fields: string[], fieldDetails: Record<string, { type: string, sampleValue: any, count: number }> } {
  const fieldSet = new Set<string>();
  const fieldDetails: Record<string, { type: string, sampleValue: any, count: number }> = {};
  
  jobs.forEach((job) => {
    // Extract all top-level fields
    Object.keys(job).forEach((key) => {
      fieldSet.add(key);
      
      if (!fieldDetails[key]) {
        const value = job[key];
        let valueType: string = typeof value;
        
        // Handle arrays and objects
        if (Array.isArray(value)) {
          valueType = 'array';
          if (value.length > 0) {
            valueType += `[${typeof value[0]}]`;
          }
        } else if (value !== null && typeof value === 'object') {
          valueType = 'object';
          // If it's an object, also note its keys
          const objKeys = Object.keys(value);
          if (objKeys.length > 0) {
            valueType += `{${objKeys.join(', ')}}`;
          }
        }
        
        fieldDetails[key] = {
          type: valueType,
          sampleValue: value,
          count: 1
        };
      } else {
        fieldDetails[key].count++;
      }
    });
    
    // Also extract nested fields from objects (like location, company, etc.)
    Object.keys(job).forEach((key) => {
      const value = job[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.keys(value).forEach((nestedKey) => {
          const nestedFieldName = `${key}.${nestedKey}`;
          fieldSet.add(nestedFieldName);
          
          if (!fieldDetails[nestedFieldName]) {
            fieldDetails[nestedFieldName] = {
              type: typeof value[nestedKey],
              sampleValue: value[nestedKey],
              count: 1
            };
          } else {
            fieldDetails[nestedFieldName].count++;
          }
        });
      }
    });
  });
  
  return {
    fields: Array.from(fieldSet).sort(),
    fieldDetails
  };
}

// Function to fetch location items and create a mapping of location codes to item IDs
async function fetchLocationMapping(): Promise<{ map: Map<string, string>, codeFieldName?: string }> {
  const locationMap = new Map<string, string>();
  let codeFieldName: string | undefined;
  
  if (!LOCATION_COLLECTION_ID) {
    console.warn('⚠️ LOCATION_COLLECTION_ID not configured, skipping location reference mapping');
    return { map: locationMap };
  }

  try {
    // First, fetch the collection structure to understand the fields
    const collectionResponse = await fetch(
      `https://api.webflow.com/v2/collections/${LOCATION_COLLECTION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'accept-version': '2.0.0',
        },
      }
    );

    if (collectionResponse.ok) {
      const collectionData = await collectionResponse.json();
      const fields = collectionData.fields || [];
      
      // Find the field that likely contains the location code
      // Look for fields with "code" in the name or slug
      const codeField = fields.find((field: any) => {
        const slug = (field.slug || '').toLowerCase();
        const name = (field.displayName || field.name || '').toLowerCase();
        return slug.includes('code') || name.includes('code') || 
               slug === 'code' || name === 'code' ||
               slug === 'location-code' || name === 'location code' ||
               slug === 'location_code' || name === 'location_code';
      });
      
      if (codeField) {
        codeFieldName = codeField.slug;
        console.log(`📍 Found location code field: "${codeFieldName}" (${codeField.displayName || codeField.name})`);
      } else {
        // Try to use 'name' or 'code' as fallback
        const nameField = fields.find((field: any) => {
          const slug = (field.slug || '').toLowerCase();
          return slug === 'name' || slug === 'code';
        });
        if (nameField) {
          codeFieldName = nameField.slug;
          console.log(`📍 Using fallback field for location code: "${codeFieldName}"`);
        } else {
          console.warn(`⚠️ Could not find location code field in collection. Available fields: ${fields.map((f: any) => f.slug).join(', ')}`);
        }
      }
    }

    // Now fetch the location items
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${LOCATION_COLLECTION_ID}/items`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'accept-version': '2.0.0',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const locations = data.items || [];
      
      console.log(`📍 Fetched ${locations.length} location items from collection ${LOCATION_COLLECTION_ID}`);
      
      // Log first location item structure for debugging
      if (locations.length > 0) {
        console.log(`📍 Sample location item fields:`, Object.keys(locations[0].fieldData || {}).join(', '));
      }
      
      // Try to find the location code field in location items
      // IMPORTANT: Location code is stored in the "name" field (e.g., "OL_LOC_0020")
      locations.forEach((location: any, index: number) => {
        const fieldData = location.fieldData || {};
        
        // PRIORITY: Use "name" field as location code (this is where location codes are stored)
        // Example: name: "OL_LOC_0020"
        let locationCode = fieldData.name || location.name || '';
        
        // Fallback: Try other fields if name is not available
        if (!locationCode) {
          locationCode = codeFieldName ? fieldData[codeFieldName] : null;
          if (!locationCode) {
            locationCode = fieldData.code || 
                          fieldData['location-code'] || 
                          fieldData.location_code ||
                          '';
          }
        }
        
        // Debug logging for first few items
        if (index < 3) {
          console.log(`📍 Location item ${index + 1}: ID=${location.id}, name="${fieldData.name || location.name}", locationCode="${locationCode}", allFields=${Object.keys(fieldData).join(', ')}`);
        }
        
        if (locationCode && location.id) {
          const codeStr = String(locationCode).trim();
          
          // Store both original case and lowercase for case-insensitive matching
          locationMap.set(codeStr, location.id);
          locationMap.set(codeStr.toLowerCase(), location.id);
          
          // Also store trimmed version (in case of whitespace issues)
          const trimmed = codeStr.trim();
          if (trimmed !== codeStr) {
            locationMap.set(trimmed, location.id);
            locationMap.set(trimmed.toLowerCase(), location.id);
          }
          
          // Store without any whitespace
          const noWhitespace = codeStr.replace(/\s+/g, '');
          if (noWhitespace !== codeStr) {
            locationMap.set(noWhitespace, location.id);
            locationMap.set(noWhitespace.toLowerCase(), location.id);
          }
          
          // Debug logging for first few items
          if (index < 3) {
            console.log(`  ✅ Added to map: "${codeStr}" -> ${location.id}`);
          }
        } else if (location.id) {
          // If no code found, log for debugging (only for first few items to avoid spam)
          if (index < 3) {
            console.warn(`⚠️ Location item ${location.id} has no location code. Available fields: ${Object.keys(fieldData).join(', ')}, name: ${location.name || 'N/A'}`);
          }
        }
      });
      
      const uniqueCodeCount = locationMap.size / 2; // Divide by 2 because we store both original and lowercase
      console.log(`✅ Created location mapping with ${uniqueCodeCount} unique location codes`);
      console.log(`📋 Location codes are matched using the "name" field from location collection`);
      console.log(`📋 Example: API location code "OL_LOC_0004" will match with location item where name="OL_LOC_0004"`);
      
      if (locationMap.size > 0) {
        // Log a few sample mappings (only original case versions, not lowercase duplicates)
        const allCodes = Array.from(locationMap.keys());
        const originalCodes = allCodes.slice(0, allCodes.length / 2); // First half are original case
        const sampleMappings = originalCodes.slice(0, 10).map(code => {
          const id = locationMap.get(code);
          return `${code} -> ${id}`;
        });
        console.log(`📍 Sample location mappings (first 10):`, sampleMappings.join(', '));
        console.log(`📍 These are location codes (from "name" field) mapped to their location item IDs`);
      }
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`❌ Failed to fetch locations: ${response.status}`, errorText.substring(0, 200));
    }
  } catch (error) {
    console.error('❌ Error fetching location mapping:', error);
  }
  
  return { map: locationMap, codeFieldName };
}

// Function to map external API data to Webflow CMS fields
function mapJobToWebflowFields(job: any, locationMap?: Map<string, string>): any {
  const fieldData: any = {};
  
  // 1. Title field - required by Webflow
  if (job.title || job.jobTitle || job.name || job.position) {
    fieldData.name = job.title || job.jobTitle || job.name || job.position || 'Untitled Job';
  } else {
    // Fallback to a default name if nothing is provided
    fieldData.name = 'Untitled Job';
  }
  
  // 2. Requisition ID
  if (job.requisitionId || job.requisition_id || job['requisition-id']) {
    fieldData['requisition-id'] = job.requisitionId || job.requisition_id || job['requisition-id'] || '';
  }
  
  // 3. Creation Date
  if (job.creationDate || job.creation_date || job['creation-date'] || job.createdAt || job.created_at) {
    const dateValue = job.creationDate || job.creation_date || job['creation-date'] || job.createdAt || job.created_at;
    // Try to format as ISO string if it's a date
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        fieldData['creation-date'] = date.toISOString();
      } else {
        fieldData['creation-date'] = dateValue;
      }
    } catch (e) {
      fieldData['creation-date'] = dateValue;
    }
  }
  
  // 4. Description 2
  // Map description field to description-2
  if (job.description || job.description2 || job.description_2 || job['description-2'] || job.secondaryDescription || job.secondary_description) {
    fieldData['description-2'] = job.description || 
                                 job.description2 || 
                                 job.description_2 || 
                                 job['description-2'] || 
                                 job.secondaryDescription || 
                                 job.secondary_description || '';
    console.log(`✅ Description-2 extracted: "${fieldData['description-2']?.substring(0, 100)}${fieldData['description-2']?.length > 100 ? '...' : ''}" (from description field)`);
  }
  
  // 5. Job Family ID
  // Check nested job_family object first (priority), then direct fields
  // Convert to string since Webflow fields are typically strings
  let jobFamilyIdValue: any = null;
  if (job.job_family?.job_family_id !== undefined && job.job_family?.job_family_id !== null) {
    jobFamilyIdValue = job.job_family.job_family_id;
  } else if (job.jobFamily?.jobFamilyId !== undefined && job.jobFamily?.jobFamilyId !== null) {
    jobFamilyIdValue = job.jobFamily.jobFamilyId;
  } else if (job.jobFamilyId !== undefined && job.jobFamilyId !== null) {
    jobFamilyIdValue = job.jobFamilyId;
  } else if (job.job_family_id !== undefined && job.job_family_id !== null) {
    jobFamilyIdValue = job.job_family_id;
  } else if (job['job-family-id'] !== undefined && job['job-family-id'] !== null) {
    jobFamilyIdValue = job['job-family-id'];
  }
  
  if (jobFamilyIdValue !== null && jobFamilyIdValue !== undefined) {
    // Convert to string (Webflow fields are typically strings)
    fieldData['job-family-id'] = String(jobFamilyIdValue);
    console.log(`✅ Job Family ID extracted: "${fieldData['job-family-id']}" (from job_family.job_family_id: ${job.job_family?.job_family_id})`);
  } else {
    console.log(`⚠️ Job Family ID not found in API data`);
    console.log(`   Checked: job.job_family?.job_family_id, job.jobFamily?.jobFamilyId, job.jobFamilyId, job.job_family_id, job['job-family-id']`);
    console.log(`   job.job_family:`, job.job_family ? JSON.stringify(job.job_family).substring(0, 200) : 'NOT FOUND');
  }
  
  // 6. Job Family Name
  // Check nested job_family object first (priority), then direct fields
  if (job.job_family?.job_family_name || job.jobFamily?.jobFamilyName || job.jobFamilyName || job.job_family_name || job['job-family-name'] || job.jobFamily?.name) {
    fieldData['job-family-name'] = job.job_family?.job_family_name || 
                                   job.jobFamily?.jobFamilyName || 
                                   job.jobFamilyName || 
                                   job.job_family_name || 
                                   job['job-family-name'] || 
                                   job.jobFamily?.name || '';
  }
  
  // 7. Job Schedule
  if (job.jobSchedule || job.job_schedule || job['job-schedule'] || job.schedule) {
    fieldData['job-schedule'] = job.jobSchedule || job.job_schedule || job['job-schedule'] || job.schedule || '';
  }
  
  // 8. Job Shift
  if (job.jobShift || job.job_shift || job['job-shift'] || job.shift) {
    fieldData['job-shift'] = job.jobShift || job.job_shift || job['job-shift'] || job.shift || '';
  }
  
  // 9. Location Description
  if (job.locationDescription || job.location_description || job['location-description'] || job.location?.description) {
    fieldData['location-description'] = job.locationDescription || job.location_description || job['location-description'] || job.location?.description || '';
  }
  
  // 10. Location ID
  if (job.locationId || job.location_id || job['location-id'] || job.location?.id) {
    fieldData['location-id'] = job.locationId || job.location_id || job['location-id'] || job.location?.id || '';
  }
  
  // 11. Location Name
  if (job.locationName || job.location_name || job['location-name'] || job.location?.name) {
    fieldData['location-name'] = job.locationName || job.location_name || job['location-name'] || job.location?.name || '';
  }
  
  // 12. Requisition Number
  if (job.requisitionNumber || job.requisition_number || job['requisition-number'] || job.reqNumber || job.req_number) {
    fieldData['requisition-number'] = job.requisitionNumber || job.requisition_number || job['requisition-number'] || job.reqNumber || job.req_number || '';
  }
  
  // 13. Short Description
  if (job.shortDescription || job.short_description || job['short-description'] || job.summary) {
    fieldData['short-description'] = job.shortDescription || job.short_description || job['short-description'] || job.summary || '';
  }
  
  // 14. State
  if (job.state || job.status) {
    fieldData.state = job.state || job.status || '';
  }
  
  // 15. Location Code field - will be set as REFERENCE field (array of item IDs)
  
  // Location Code field - extract from location object or direct field
  // PRIORITY: job.location.location_code (this is what we want to bind with reference field)
  // Try multiple possible field name variations
  // If locationMap is provided, set as reference field (array of item IDs)
  console.log(`\n📥 ===== EXTRACTING LOCATION CODE FROM API =====`);
  console.log(`📥 Job data keys: ${Object.keys(job).join(', ')}`);
  console.log(`📥 Checking for location code in API data...`);
  console.log(`   - job.locationCode: ${job.locationCode || 'NOT FOUND'}`);
  console.log(`   - job.location_code: ${job.location_code || 'NOT FOUND'}`);
  console.log(`   - job['location-code']: ${job['location-code'] || 'NOT FOUND'}`);
  console.log(`   - job.location: ${job.location ? JSON.stringify(job.location).substring(0, 100) : 'NOT FOUND'}`);
  
  // PRIORITY: Check job.location.location_code FIRST (this is what user wants to bind)
  let locationCodeValue = '';
  if (job.location && typeof job.location === 'object') {
    console.log(`   - job.location.location_code: ${job.location.location_code || 'NOT FOUND'}`);
    console.log(`   - job.location.locationCode: ${job.location.locationCode || 'NOT FOUND'}`);
    console.log(`   - job.location keys: ${Object.keys(job.location).join(', ')}`);
    
    // PRIORITY: job.location.location_code is the primary source
    if (job.location.location_code) {
      locationCodeValue = job.location.location_code;
      console.log(`✅ FOUND location code in job.location.location_code: "${locationCodeValue}"`);
    } else if (job.location.locationCode) {
      locationCodeValue = job.location.locationCode;
      console.log(`✅ FOUND location code in job.location.locationCode: "${locationCodeValue}"`);
    }
  }
  
  // Fallback to other locations if not found in job.location
  if (!locationCodeValue) {
    locationCodeValue = job.locationCode || job.location_code || job['location-code'] || '';
    if (locationCodeValue) {
      console.log(`✅ FOUND location code in fallback location: "${locationCodeValue}"`);
    }
  }
  
  console.log(`📥 Extracted locationCodeValue: "${locationCodeValue}" (type: ${typeof locationCodeValue})`);
  
  // Build location as text field - use location code directly
  let locationAsText = '';
  let locationCodeStr = '';
  
  // Extract location code first
  if (locationCodeValue) {
    locationCodeStr = String(locationCodeValue).trim();
    console.log(`✅ Location code found in API: "${locationCodeStr}"`);
    console.log(`✅ This location code will be matched with location collection and set as REFERENCE field`);
  } else {
    console.warn(`⚠️ No location code found in API data!`);
    console.warn(`   Checked: location.location_code (PRIORITY), location.locationCode, locationCode, location_code, location-code`);
  }
  console.log(`📥 ===== END EXTRACTING LOCATION CODE =====\n`);
  
  // REMOVED: location-as-text field - not needed, only location-code reference field is used
  
  // Location Code field - MUST be set as REFERENCE field (array of item IDs), NOT as text
  // Step 1: Extract location code from API
  // Step 2: Match with location collection
  // Step 3: Set matched location item ID as reference (array format)
  if (locationCodeValue && locationCodeStr) {
    console.log(`\n🔍 ===== LOCATION CODE MATCHING (REFERENCE FIELD) =====`);
    console.log(`🔍 Step 1: Extracted location code from API: "${locationCodeStr}"`);
    console.log(`🔍 Step 2: Location map size: ${locationMap?.size || 0}`);
    
    // If locationMap is provided, try to find matching location and set as reference
    if (locationMap && locationMap.size > 0) {
      console.log(`🔍 Step 3: Attempting to match location code "${locationCodeStr}" with location collection...`);
      
      // Try exact match first
      let locationId = locationMap.get(locationCodeStr);
      console.log(`  - Exact match "${locationCodeStr}": ${locationId || 'NOT FOUND'}`);
      
      // If not found, try case-insensitive match
      if (!locationId) {
        locationId = locationMap.get(locationCodeStr.toLowerCase());
        console.log(`  - Case-insensitive match "${locationCodeStr.toLowerCase()}": ${locationId || 'NOT FOUND'}`);
      }
      
      // If still not found, try with trimmed whitespace
      if (!locationId) {
        const trimmed = locationCodeStr.trim();
        locationId = locationMap.get(trimmed) || locationMap.get(trimmed.toLowerCase());
        console.log(`  - Trimmed match "${trimmed}": ${locationId || 'NOT FOUND'}`);
      }
      
      // If still not found, try without any whitespace
      if (!locationId) {
        const noWhitespace = locationCodeStr.replace(/\s+/g, '');
        locationId = locationMap.get(noWhitespace) || locationMap.get(noWhitespace.toLowerCase());
        console.log(`  - No whitespace match "${noWhitespace}": ${locationId || 'NOT FOUND'}`);
      }
      
      // Log all available location codes for debugging if not found
      if (!locationId) {
        const allCodes = Array.from(locationMap.keys());
        const originalCodes = allCodes.slice(0, allCodes.length / 2); // First half are original case
        console.warn(`\n⚠️ ===== LOCATION CODE NOT FOUND =====`);
        console.warn(`⚠️ Location code "${locationCodeStr}" not found in location collection`);
        console.warn(`   Available location codes (first 20): ${originalCodes.slice(0, 20).join(', ')}`);
        console.warn(`   Total location codes in map: ${locationMap.size / 2}`);
        console.warn(`   Searching for: "${locationCodeStr}"`);
        console.warn(`   Map contains (first 10 keys): ${Array.from(locationMap.keys()).slice(0, 10).join(', ')}`);
      }
      
      if (locationId) {
        // USER REQUEST: Store location code name (e.g., "OL_LOC_0020") instead of ID
        // NOTE: This may cause validation errors if location-code is a reference field in Webflow
        // Reference fields typically require item IDs, not text values
        fieldData['_location_reference_id'] = locationId; // Keep ID for fallback
        fieldData['_location_code_str'] = locationCodeStr; // Store the location code name (e.g., "OL_LOC_0020")
        
        // Find the location name for better logging
        const matchedLocation = Array.from(locationMap.entries()).find(([code, id]) => id === locationId);
        const locationName = matchedLocation ? matchedLocation[0] : locationCodeStr;
        
        console.log(`✅ Step 4: Successfully matched location code "${locationCodeStr}" from API`);
        console.log(`✅ Matched with location collection item where name="${locationName}"`);
        console.log(`✅ Location item ID: ${locationId}`);
        console.log(`✅ Using location code name "${locationCodeStr}" instead of ID (as requested)`);
        console.log(`✅ Process: API code "${locationCodeStr}" → Matched with location name="${locationName}" → Using code name "${locationCodeStr}" as value`);
        console.log(`⚠️ NOTE: If location-code is a reference field, this may cause validation errors. Reference fields require item IDs.`);
        console.log(`🔍 ===== END LOCATION CODE MATCHING =====\n`);
      } else {
        console.warn(`⚠️ Location code "${locationCodeStr}" not found in location collection`);
        console.warn(`⚠️ Will NOT set reference field (no match found)`);
        console.warn(`🔍 ===== END LOCATION CODE MATCHING =====\n`);
      }
    } else {
      console.warn(`⚠️ No location map available for location code: "${locationCodeStr}"`);
      console.warn(`   Location map is: ${locationMap ? 'defined but empty' : 'undefined'}`);
      console.warn(`⚠️ Cannot set reference field without location map`);
    }
  } else {
    console.log(`ℹ️ No location code found in job data - cannot set reference field`);
    console.log(`   locationCodeValue: ${locationCodeValue}`);
    console.log(`   locationCodeStr: ${locationCodeStr}`);
  }
  
  // NO OTHER FIELDS - Only title and location code are mapped
  // All extra field mappings have been removed
  
  return fieldData;
}

export async function POST(request: Request) {
  try {
    console.log(`🔄 Starting sync to Webflow Collection ID: ${COLLECTION_ID}`);
    
    // Fetch location mapping for reference fields
    const { map: locationMap, codeFieldName: locationCodeFieldName } = await fetchLocationMapping();
    
    // First, fetch collection structure to see available fields
    const collectionResponse = await fetch(
      `https://api.webflow.com/v2/collections/${COLLECTION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'accept-version': '2.0.0',
        },
      }
    );

    let availableFields: string[] = [];
    let collectionName = 'Unknown';
    let allFieldDetails: any[] = [];
    let locationCodeFieldSlug: string | undefined;
    let locationCodeFieldIsReference: boolean = false; // Track if location-code is a reference field
    if (collectionResponse.ok) {
      const collectionData = await collectionResponse.json();
      collectionName = collectionData.displayName || collectionData.name || 'Unknown';
      allFieldDetails = collectionData.fields || [];
      availableFields = allFieldDetails.map((field: any) => field.slug || field.id);
      console.log(`✅ Collection found: "${collectionName}" with ${availableFields.length} fields`);
      console.log(`📋 Available field slugs:`, availableFields.join(', '));
      // Log field details for debugging
      console.log(`\n🔍 ===== COLLECTION FIELD ANALYSIS =====`);
      allFieldDetails.forEach((field: any) => {
        const fieldType = field.type || 'unknown type';
        const isReference = fieldType === 'ItemRef' || fieldType === 'ItemRefSet' || fieldType === 'Reference';
        const slug = (field.slug || '').toLowerCase();
        const name = (field.displayName || field.name || '').toLowerCase();
        const hasLocation = slug.includes('location') || name.includes('location');
        const hasCode = slug.includes('code') || name.includes('code');
        
        console.log(`  - ${field.slug || field.id}: ${field.displayName || field.name || 'unnamed'} (${fieldType})${isReference ? ' [REFERENCE]' : ''}`);
        
        // Find the location-code field (can be reference OR text field)
        // Try multiple matching strategies:
        // 1. Field has both "location" AND "code" in name/slug
        // 2. Field has "location" in name/slug and is a reference (might be the location reference)
        // 3. Field slug matches common patterns like "location-code", "locationcode", "location_code"
        if (hasLocation && hasCode) {
          locationCodeFieldSlug = field.slug;
          locationCodeFieldIsReference = isReference;
          console.log(`  🔗 ✅ FOUND location-code field: "${locationCodeFieldSlug}"`);
          console.log(`     Type: ${fieldType}, Display: ${field.displayName || field.name}`);
          console.log(`     Is Reference Field: ${isReference ? 'YES (requires item IDs)' : 'NO (can use text values)'}`);
        }
        // Strategy 2: Common slug patterns for location code
        else if (!locationCodeFieldSlug && (
          slug === 'location-code' || 
          slug === 'locationcode' || 
          slug === 'location_code' ||
          slug.includes('location') && slug.includes('code')
        )) {
          locationCodeFieldSlug = field.slug;
          locationCodeFieldIsReference = isReference;
          console.log(`  🔗 ✅ FOUND location-code field (strategy 2): "${locationCodeFieldSlug}"`);
          console.log(`     Type: ${fieldType}, Display: ${field.displayName || field.name}`);
          console.log(`     Is Reference Field: ${isReference ? 'YES (requires item IDs)' : 'NO (can use text values)'}`);
        }
        
        if (isReference && (hasLocation || hasCode) && !locationCodeFieldSlug) {
          console.log(`  🔍 Reference field found but doesn't match: ${field.slug} (location: ${hasLocation}, code: ${hasCode})`);
        }
      });
      
      if (!locationCodeFieldSlug) {
        console.warn(`\n⚠️ ===== LOCATION CODE REFERENCE FIELD NOT FOUND =====`);
        console.warn(`⚠️ Could not find location-code reference field in collection!`);
        console.warn(`   Looking for: Reference field with "location" AND "code" in name/slug`);
        console.warn(`   All reference fields found:`);
        allFieldDetails.forEach((field: any) => {
          const fieldType = field.type || 'unknown type';
          const isReference = fieldType === 'ItemRef' || fieldType === 'ItemRefSet' || fieldType === 'Reference';
          if (isReference) {
            console.warn(`     - ${field.slug}: ${field.displayName || field.name} (${fieldType})`);
          }
        });
        console.warn(`⚠️ ===== END WARNING =====\n`);
      } else {
        console.log(`✅ Location code reference field slug: "${locationCodeFieldSlug}"`);
      }
      console.log(`🔍 ===== END COLLECTION ANALYSIS =====\n`);
    } else {
      const errorText = await collectionResponse.text().catch(() => 'Unknown error');
      console.error(`❌ Failed to fetch collection ${COLLECTION_ID}:`, collectionResponse.status, errorText.substring(0, 200));
      // Don't proceed if we can't fetch collection - we need to know available fields
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch collection structure from Webflow',
          details: `HTTP ${collectionResponse.status}: ${collectionResponse.statusText}`,
          technicalDetails: errorText.substring(0, 500),
        },
        { status: 200 }
      );
    }

    // Fetch data from external API with retry logic
    let externalResponse: Response | undefined;
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        console.log(`[POST] Attempting to fetch external API (attempt ${attempt}/${maxRetries})...`);
        
        externalResponse = await fetch(EXTERNAL_API_URL, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; WebflowSync/1.0)',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // If we got a 5xx error, retry (unless it's the last attempt)
        if (!externalResponse.ok && externalResponse.status >= 500 && attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`[POST] API returned ${externalResponse.status}, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Success or non-retryable error, break out of retry loop
        break;
      } catch (fetchError: any) {
        lastError = fetchError;
        console.error(`[POST] Error fetching external API (attempt ${attempt}/${maxRetries}):`, fetchError);
        
        // If it's a timeout or network error and not the last attempt, retry
        if ((fetchError.name === 'AbortError' || fetchError.message?.includes('fetch')) && attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[POST] Network error, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Last attempt or non-retryable error
        if (attempt === maxRetries) {
          const errorMessage = fetchError.name === 'AbortError' 
            ? 'Request timeout - the external API took too long to respond after multiple attempts'
            : fetchError instanceof Error ? fetchError.message : 'Network error';
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to fetch from external API after multiple attempts',
              details: errorMessage,
            },
            { status: 500 }
          );
        }
      }
    }

    // Check if externalResponse is defined before accessing its properties
    if (!externalResponse) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch from external API - no response received after multiple attempts',
          details: 'The external API did not return a response. Please try again later.',
        },
        { status: 500 }
      );
    }

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text().catch(() => 'Unknown error');
      console.error('External API error after retries:', externalResponse.status, errorText.substring(0, 200));
      // Provide helpful error messages based on status code
      let userFriendlyMessage = '';
      if (externalResponse.status === 500) {
        userFriendlyMessage = 'The external API server is experiencing issues. We tried multiple times but the server is still returning errors. Please try again later or contact the API provider.';
      } else if (externalResponse.status === 404) {
        userFriendlyMessage = 'The API endpoint was not found. Please check if the API URL is correct.';
      } else if (externalResponse.status === 403) {
        userFriendlyMessage = 'Access forbidden. The API may require authentication or have access restrictions.';
      } else if (externalResponse.status >= 500) {
        userFriendlyMessage = 'The external API server is down or experiencing issues. We tried multiple times but the server is still returning errors. Please try again later.';
      } else {
        userFriendlyMessage = `The external API returned an error (${externalResponse.status}).`;
      }
      
      return NextResponse.json(
        {
          success: false,
          error: userFriendlyMessage,
          details: `HTTP ${externalResponse.status}: ${externalResponse.statusText} (after ${maxRetries} attempts)`,
          technicalDetails: errorText.substring(0, 200),
        },
        { status: 200 } // Return 200 so frontend can display the error message
      );
    }

    // Check if response is actually JSON
    const contentType = externalResponse.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    
    let externalData;
    try {
      if (isJson) {
        externalData = await externalResponse.json();
      } else {
        // Response is not JSON (likely HTML error page)
        const textResponse = await externalResponse.text();
        console.error('External API returned non-JSON response:', textResponse.substring(0, 200));
        
        // Check if it's an HTML error page
        if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
          return NextResponse.json(
            {
              success: false,
              error: 'The external API returned an HTML error page instead of JSON. The API server may be down or experiencing issues.',
              details: `HTTP ${externalResponse.status}: ${externalResponse.statusText}`,
              technicalDetails: 'Response appears to be an HTML error page (likely from Cloudflare or server error page)',
            },
            { status: 200 }
          );
        }
        
        // Try to parse as JSON anyway (in case content-type is wrong)
        try {
          externalData = JSON.parse(textResponse);
        } catch (e) {
          return NextResponse.json(
            {
              success: false,
              error: 'The external API returned an invalid response format',
              details: `HTTP ${externalResponse.status}: ${externalResponse.statusText}`,
              technicalDetails: textResponse.substring(0, 500),
            },
            { status: 200 }
          );
        }
      }
    } catch (parseError) {
      console.error('Error parsing external API response:', parseError);
      const textResponse = await externalResponse.text();
      
      // Check if it's HTML
      if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
        return NextResponse.json(
          {
            success: false,
            error: 'The external API returned an HTML error page instead of JSON. The API server may be down or experiencing issues.',
            details: `HTTP ${externalResponse.status}: ${externalResponse.statusText}`,
            technicalDetails: 'Response appears to be an HTML error page (likely from Cloudflare or server error page)',
          },
          { status: 200 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON response from external API',
          details: textResponse.substring(0, 500),
        },
        { status: 500 }
      );
    }
    
    // Handle different response formats (array or object with array)
    let jobs: any[] = [];
    if (Array.isArray(externalData)) {
      jobs = externalData;
    } else if (externalData.jobs && Array.isArray(externalData.jobs)) {
      jobs = externalData.jobs;
    } else if (externalData.data && Array.isArray(externalData.data)) {
      jobs = externalData.data;
    } else if (externalData.items && Array.isArray(externalData.items)) {
      jobs = externalData.items;
    } else {
      // If it's a single object, wrap it in an array
      jobs = [externalData];
    }

    if (jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No jobs found in external API',
        synced: 0,
        skipped: 0,
      });
    }

    // Extract and log all fields from API data
    const { fields: allApiFields, fieldDetails } = extractAllFieldsFromApiData(jobs);
    console.log(`📊 API Data Analysis: Found ${allApiFields.length} unique fields in ${jobs.length} job(s)`);
    console.log(`📋 All API fields:`, allApiFields.join(', '));
    
    // Log detailed field information
    console.log(`\n📊 Detailed Field Information:`);
    allApiFields.forEach((field) => {
      const details = fieldDetails[field];
      const sampleValue = details.sampleValue;
      let sampleStr = '';
      
      if (sampleValue === null || sampleValue === undefined) {
        sampleStr = String(sampleValue);
      } else if (typeof sampleValue === 'object') {
        sampleStr = Array.isArray(sampleValue) 
          ? `[${sampleValue.length} items]`
          : `{${Object.keys(sampleValue).join(', ')}}`;
      } else if (typeof sampleValue === 'string' && sampleValue.length > 50) {
        sampleStr = sampleValue.substring(0, 50) + '...';
      } else {
        sampleStr = String(sampleValue);
      }
      
      console.log(`  - ${field}: ${details.type} (found in ${details.count}/${jobs.length} items) | Sample: ${sampleStr}`);
    });
    console.log(''); // Empty line for readability

    const originalJobCount = jobs.length;

    // Get existing items from Webflow to check for duplicates
    const existingItemsResponse = await fetch(
      `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'accept-version': '2.0.0',
        },
      }
    );

    let existingItems: any[] = [];
    if (existingItemsResponse.ok) {
      try {
        const existingData = await existingItemsResponse.json();
        existingItems = existingData.items || [];
        console.log(`📋 Found ${existingItems.length} existing items in collection`);
      } catch (e) {
        console.error('Error parsing existing items:', e);
        // Continue with empty array if parsing fails
      }
    } else {
      console.error(`❌ Failed to fetch existing items: ${existingItemsResponse.status}`);
      // Continue with empty array - will try to create all items
    }

    // Track results
    let synced = 0;
    let skipped = 0;
    let unpublished = 0;
    let published = 0;
    let unarchived = 0;
    const errors: string[] = [];
    
    // Create a set of unique identifiers from API jobs for matching
    // Use requisition-id as primary identifier, fallback to name
    const apiJobIdentifiers = new Set<string>();
    const apiJobMap = new Map<string, any>(); // Map identifier to job for reference
    
    jobs.forEach((job: any) => {
      const requisitionId = job.requisitionId || job.requisition_id || job['requisition-id'] || '';
      const jobName = job.title || job.jobTitle || job.name || '';
      
      if (requisitionId) {
        apiJobIdentifiers.add(`req:${requisitionId}`);
        apiJobMap.set(`req:${requisitionId}`, job);
      }
      if (jobName) {
        apiJobIdentifiers.add(`name:${jobName}`);
        apiJobMap.set(`name:${jobName}`, job);
      }
    });
    
    console.log(`📊 API jobs have ${apiJobIdentifiers.size} unique identifiers for matching`);

    // Process each job
    for (const job of jobs) {
      try {
        // Check if job already exists (by requisition-id, name, or URL)
        const jobRequisitionId = job.requisitionId || job.requisition_id || job['requisition-id'] || '';
        const jobName = job.title || job.jobTitle || job.name || '';
        const jobUrl = job.url || job.applyUrl || job.link || '';
        
        // Find existing item by requisition-id (most reliable), then name, then URL
        let existingItem: any = null;
        
        if (jobRequisitionId) {
          existingItem = existingItems.find((item: any) => {
            const itemRequisitionId = item.fieldData?.['requisition-id'] || '';
            return itemRequisitionId === jobRequisitionId;
          });
        }
        
        if (!existingItem && jobName) {
          existingItem = existingItems.find((item: any) => {
            const itemName = item.fieldData?.name || '';
            return itemName === jobName;
          });
        }
        
        if (!existingItem && jobUrl) {
          existingItem = existingItems.find((item: any) => {
            const itemUrl = item.fieldData?.['ticket-link'] || '';
            return itemUrl === jobUrl;
          });
        }

        // If item exists and is archived, unarchive and publish it immediately
        if (existingItem && existingItem.isArchived) {
          try {
            console.log(`♻️ Unarchiving and publishing item: "${jobName || existingItem.id}" (job is back in API)`);
            
            // Map the job data to get updated field data
            const fieldData = mapJobToWebflowFields(job, locationMap);
            
            // Filter fieldData to only include valid fields
            const filteredFieldData: any = {};
            Object.keys(fieldData).forEach((key) => {
              if (key.startsWith('_')) {
                return; // Skip internal fields
              }
              if (availableFields.includes(key)) {
                filteredFieldData[key] = fieldData[key];
              }
            });
            
            // Handle location reference field if needed
            if (locationCodeFieldSlug && fieldData['_location_code_str']) {
              if (locationCodeFieldIsReference && fieldData['_location_reference_id']) {
                filteredFieldData[locationCodeFieldSlug] = [fieldData['_location_reference_id']];
              } else if (!locationCodeFieldIsReference && fieldData['_location_code_str']) {
                filteredFieldData[locationCodeFieldSlug] = fieldData['_location_code_str'];
              }
            }
            
            // Use /items/live endpoint to update and publish immediately (same as creating new items)
            // This ensures immediate publishing, not queued
            const unarchiveResponse = await fetch(
              `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/live/${existingItem.id}`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${AUTH_TOKEN}`,
                  'accept-version': '2.0.0',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  fieldData: filteredFieldData,
                  isArchived: false,
                  isDraft: false, // Ensure it's published immediately
                }),
              }
            );
            
            if (unarchiveResponse.ok) {
              unarchived++;
              console.log(`✅ Successfully unarchived and published item (live): "${jobName || existingItem.id}"`);
              // Update the item in existingItems array so it's not archived anymore
              existingItem.isArchived = false;
            } else {
              // If /items/live fails, try regular PATCH as fallback
              console.warn(`⚠️ /items/live endpoint failed, trying regular PATCH for "${jobName || existingItem.id}"`);
              
              const fallbackResponse = await fetch(
                `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/${existingItem.id}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'accept-version': '2.0.0',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    fieldData: filteredFieldData,
                    isArchived: false,
                    isDraft: false,
                  }),
                }
              );
              
              if (fallbackResponse.ok) {
                unarchived++;
                console.log(`✅ Successfully unarchived item (fallback): "${jobName || existingItem.id}"`);
                existingItem.isArchived = false;
              } else {
                const errorText = await fallbackResponse.text().catch(() => 'Unknown error');
                console.error(`❌ Failed to unarchive item "${jobName || existingItem.id}":`, errorText.substring(0, 200));
                errors.push(`Failed to unarchive item "${jobName || existingItem.id}": ${errorText.substring(0, 100)}`);
              }
            }
          } catch (unarchiveError) {
            console.error(`❌ Error unarchiving item "${jobName || existingItem.id}":`, unarchiveError);
            errors.push(`Error unarchiving item "${jobName || existingItem.id}": ${unarchiveError instanceof Error ? unarchiveError.message : 'Unknown error'}`);
          }
        }
        
        // If item exists and is not archived, skip creating it
        if (existingItem && !existingItem.isArchived) {
          skipped++;
          continue;
        }

        // Map job data to Webflow fields (pass locationMap for reference field mapping)
        const fieldData = mapJobToWebflowFields(job, locationMap);
        
        // Filter fieldData to ONLY include fields that exist in the collection
        // This prevents validation errors from Webflow
        const filteredFieldData: any = {};
        
        // CRITICAL: Handle location reference field FIRST
        // This MUST be set as an array of item IDs (reference format), NOT as text
        // Process: API location code (text) -> Match with collection -> Get item ID -> Set as reference (array)
        console.log(`\n🔗 ===== SETTING LOCATION REFERENCE FIELD (ARRAY OF ITEM IDs) =====`);
        console.log(`🔗 Step 1: Field slug detection - locationCodeFieldSlug: "${locationCodeFieldSlug}"`);
        console.log(`🔗 Step 2: Location matching - _location_reference_id: "${fieldData['_location_reference_id']}"`);
        console.log(`🔗 Step 3: Field validation - availableFields includes locationCodeFieldSlug: ${locationCodeFieldSlug ? availableFields.includes(locationCodeFieldSlug) : 'N/A'}`);
        
        if (locationCodeFieldSlug && (fieldData['_location_code_str'] || fieldData['_location_reference_id'])) {
          const locationCodeName = fieldData['_location_code_str']; // Location code name (e.g., "OL_LOC_0020")
          const locationId = fieldData['_location_reference_id']; // Location item ID
          
          // SMART DETECTION: Use the correct format based on field type
          // If it's a reference field, use ID (required by Webflow)
          // If it's a text field, use the location code name
          if (locationCodeFieldIsReference) {
            // Reference field - MUST use item ID
            if (locationId) {
              filteredFieldData[locationCodeFieldSlug] = [locationId];
              console.log(`✅ Step 4: Setting location field "${locationCodeFieldSlug}" as REFERENCE (using item ID)`);
              console.log(`✅ Location item ID: ${locationId}`);
              console.log(`✅ Location code name (matched): "${locationCodeName || 'N/A'}"`);
              console.log(`✅ Field format: ${JSON.stringify({ [locationCodeFieldSlug]: [locationId] })}`);
              console.log(`✅ Using ID because field type is REFERENCE (requires item IDs, not text)`);
            } else {
              console.warn(`⚠️ Location code field is a REFERENCE but no location ID found!`);
              console.warn(`   Location code name: "${locationCodeName || 'N/A'}"`);
              console.warn(`   Cannot set reference field without item ID`);
            }
          } else {
            // Text field - can use location code name
            if (locationCodeName) {
              filteredFieldData[locationCodeFieldSlug] = locationCodeName; // Text field, not array
              console.log(`✅ Step 4: Setting location field "${locationCodeFieldSlug}" as TEXT (using location code name)`);
              console.log(`✅ Location code name: "${locationCodeName}"`);
              console.log(`✅ Location item ID (available but not used): ${locationId || 'N/A'}`);
              console.log(`✅ Field format: ${JSON.stringify({ [locationCodeFieldSlug]: locationCodeName })}`);
              console.log(`✅ Using location code name because field type is TEXT (can accept text values)`);
            } else {
              console.warn(`⚠️ Location code field is TEXT but no location code name found!`);
            }
          }
          
          // Also add to availableFields if not already there (to prevent removal)
          if (!availableFields.includes(locationCodeFieldSlug)) {
            availableFields.push(locationCodeFieldSlug);
            console.log(`✅ Added "${locationCodeFieldSlug}" to availableFields to prevent removal`);
          }
        } else {
          console.warn(`⚠️ Cannot set location reference field:`);
          console.warn(`   - locationCodeFieldSlug: ${locationCodeFieldSlug || 'NOT FOUND'}`);
          console.warn(`   - _location_reference_id: ${fieldData['_location_reference_id'] || 'NOT FOUND'}`);
          if (!locationCodeFieldSlug) {
            console.warn(`   ⚠️ The location-code reference field was not detected in the collection schema!`);
            console.warn(`   ⚠️ Please check that the field exists and is a reference field type.`);
          }
          if (!fieldData['_location_reference_id']) {
            console.warn(`   ⚠️ No location code was matched from the API data!`);
            console.warn(`   ⚠️ Check that location_code exists in API data and matches location collection.`);
          }
        }
        console.log(`🔗 ===== END SETTING LOCATION REFERENCE =====\n`);
        
        Object.keys(fieldData).forEach((key) => {
          // Skip internal fields used for processing
          if (key.startsWith('_')) {
            return;
          }
          
          // IMPORTANT: Skip location-code field here - it's already handled above as a reference
          // We don't want to accidentally set it as text
          if (locationCodeFieldSlug && key === locationCodeFieldSlug) {
            console.log(`⏭️ Skipping "${key}" - already set as reference field above`);
            return;
          }
          
          // Special logging for job-family-id to debug why it might be blank
          if (key === 'job-family-id') {
            console.log(`\n🔍 ===== PROCESSING job-family-id FIELD =====`);
            console.log(`🔍 Field key: "${key}"`);
            console.log(`🔍 Field value: "${fieldData[key]}" (type: ${typeof fieldData[key]})`);
            console.log(`🔍 Available fields: ${availableFields.join(', ')}`);
            console.log(`🔍 Is in availableFields? ${availableFields.includes(key)}`);
          }
          
          // Only include field if it exists in the collection's available fields
          if (availableFields.length > 0) {
            if (availableFields.includes(key)) {
              // Field exists, add it
              // Check if it's a reference field (array) and ensure it's properly formatted
              const fieldValue = fieldData[key];
              if (Array.isArray(fieldValue) && fieldValue.length > 0) {
                // This is likely a reference field - keep as array
                filteredFieldData[key] = fieldValue;
                console.log(`🔗 Setting reference field "${key}" with value:`, fieldValue);
              } else {
                filteredFieldData[key] = fieldValue;
                if (key === 'job-family-id') {
                  console.log(`✅ job-family-id added to filteredFieldData: "${fieldValue}"`);
                }
              }
            } else {
              // Field doesn't match exactly - try case-insensitive and variation matching
              const matchingField = availableFields.find(f => {
                const fLower = f.toLowerCase();
                const keyLower = key.toLowerCase();
                return fLower === keyLower || 
                       fLower.replace(/[-_]/g, '') === keyLower.replace(/[-_]/g, '') ||
                       fLower.replace(/-/g, '_') === keyLower.replace(/-/g, '_') ||
                       fLower.replace(/_/g, '-') === keyLower.replace(/_/g, '-');
              });
              
              if (matchingField) {
                filteredFieldData[matchingField] = fieldData[key];
                console.log(`✅ Mapped field "${key}" to collection field "${matchingField}"`);
                if (key === 'job-family-id') {
                  console.log(`✅ job-family-id mapped to "${matchingField}" with value: "${fieldData[key]}"`);
                }
              } else {
                console.log(`⚠️ Skipping field "${key}" - not found in collection schema`);
                if (key === 'job-family-id') {
                  console.error(`❌ ERROR: job-family-id field not found in collection!`);
                  console.error(`   Looking for: "${key}"`);
                  console.error(`   Available fields: ${availableFields.join(', ')}`);
                  console.error(`   Try checking if the field slug in Webflow matches exactly`);
                }
              }
            }
          } else {
            // If we couldn't fetch available fields, only include the 'name' field (required)
            if (key === 'name') {
              filteredFieldData[key] = fieldData[key];
            } else {
              console.log(`⚠️ Skipping field "${key}" - collection schema not available`);
            }
          }
          
          if (key === 'job-family-id') {
            console.log(`🔍 Final status: ${filteredFieldData.hasOwnProperty('job-family-id') || filteredFieldData.hasOwnProperty('job_family_id') ? '✅ INCLUDED' : '❌ NOT INCLUDED'}`);
            console.log(`🔍 ===== END PROCESSING job-family-id =====\n`);
          }
        });
        
        // Final cleanup: remove any fields that still don't match (safety check)
        // BUT preserve reference fields that were explicitly set (like location-code)
        Object.keys(filteredFieldData).forEach((key) => {
          if (availableFields.length > 0 && !availableFields.includes(key)) {
            // Don't remove if it's the location-code reference field that was explicitly mapped
            if (locationCodeFieldSlug && key === locationCodeFieldSlug && Array.isArray(filteredFieldData[key])) {
              console.log(`✅ Preserving location-code reference field "${key}" even though it's not in availableFields`);
              return; // Keep this field
            }
            console.log(`🗑️ Removing field "${key}" - final safety check failed`);
            delete filteredFieldData[key];
          }
        });
        
        // CRITICAL: Double-check and FORCE location reference field to be set
        // This ensures the location reference is always set if we have a matching location code
        console.log(`\n🔗 ===== DOUBLE-CHECK LOCATION REFERENCE =====`);
        console.log(`🔗 locationCodeFieldSlug: "${locationCodeFieldSlug}"`);
        console.log(`🔗 Already in filteredFieldData: ${locationCodeFieldSlug ? filteredFieldData.hasOwnProperty(locationCodeFieldSlug) : 'N/A'}`);
        console.log(`🔗 Current filteredFieldData keys: ${Object.keys(filteredFieldData).join(', ')}`);
        console.log(`🔗 fieldData['_location_reference_id']: ${fieldData['_location_reference_id'] || 'NOT FOUND'}`);
        
        // FORCE set the location field if we have both the slug and the value
        if (locationCodeFieldSlug) {
          if (locationCodeFieldIsReference && fieldData['_location_reference_id']) {
            // Reference field - use ID
            filteredFieldData[locationCodeFieldSlug] = [fieldData['_location_reference_id']];
            console.log(`✅ FORCED setting location field "${locationCodeFieldSlug}" with ID (reference field): ${fieldData['_location_reference_id']}`);
          } else if (!locationCodeFieldIsReference && fieldData['_location_code_str']) {
            // Text field - use location code name
            filteredFieldData[locationCodeFieldSlug] = fieldData['_location_code_str'];
            console.log(`✅ FORCED setting location field "${locationCodeFieldSlug}" with code name (text field): ${fieldData['_location_code_str']}`);
          } else if (fieldData['_location_reference_id']) {
            // Fallback: Use ID if available
            filteredFieldData[locationCodeFieldSlug] = [fieldData['_location_reference_id']];
            console.log(`✅ FORCED setting location field "${locationCodeFieldSlug}" with ID (fallback): ${fieldData['_location_reference_id']}`);
          } else {
            console.log(`⚠️ No _location_reference_id found, trying to match from job data...`);
            // Try to find location code from job and match it again (fallback)
            const locationCodeFromJob = job.location?.location_code || job.location?.locationCode ||
                                       job.location_code || job.locationCode || job['location-code'];
            console.log(`   Location code from job: "${locationCodeFromJob}"`);
            
            if (locationCodeFromJob && locationMap && locationMap.size > 0) {
              const locationCodeStr = String(locationCodeFromJob).trim();
              
              // Try multiple matching strategies (same as above)
              let locationId = locationMap.get(locationCodeStr) || 
                             locationMap.get(locationCodeStr.toLowerCase()) ||
                             locationMap.get(locationCodeStr.trim()) ||
                             locationMap.get(locationCodeStr.trim().toLowerCase());
              
              // Try without whitespace
              if (!locationId) {
                const noWhitespace = locationCodeStr.replace(/\s+/g, '');
                locationId = locationMap.get(noWhitespace) || locationMap.get(noWhitespace.toLowerCase());
              }
              
              if (locationId) {
                // Use the correct format based on field type
                if (locationCodeFieldIsReference) {
                  // Reference field - use ID
                  filteredFieldData[locationCodeFieldSlug] = [locationId];
                  console.log(`✅ Matched and FORCED setting location field "${locationCodeFieldSlug}" with ID (reference): ${locationId} for code: "${locationCodeStr}"`);
                } else {
                  // Text field - use location code name
                  filteredFieldData[locationCodeFieldSlug] = locationCodeStr;
                  console.log(`✅ Matched and FORCED setting location field "${locationCodeFieldSlug}" with code name (text): "${locationCodeStr}" (matched ID: ${locationId})`);
                }
              } else {
                console.warn(`⚠️ Could not match location code "${locationCodeStr}" to any location in collection`);
              }
            } else {
              console.warn(`⚠️ Cannot match: locationCodeFromJob="${locationCodeFromJob}", locationMap.size=${locationMap?.size || 0}`);
            }
          }
          
          // Final verification
          if (filteredFieldData[locationCodeFieldSlug]) {
            console.log(`✅ Location reference CONFIRMED in filteredFieldData: ${JSON.stringify(filteredFieldData[locationCodeFieldSlug])}`);
          } else {
            console.error(`❌ ERROR: Location reference field "${locationCodeFieldSlug}" is STILL NOT in filteredFieldData after all attempts!`);
          }
        } else {
          console.error(`❌ ERROR: locationCodeFieldSlug is not set - cannot set location reference field!`);
        }
        console.log(`🔗 ===== END DOUBLE-CHECK =====\n`);
        
        // Ensure 'name' field exists (required by Webflow)
        if (!filteredFieldData.name && fieldData.name) {
          filteredFieldData.name = fieldData.name;
        }
        
        // Log what we're about to create
        const skippedFields = Object.keys(fieldData).filter(key => !filteredFieldData.hasOwnProperty(key));
        if (skippedFields.length > 0) {
          console.log(`⚠️ Skipped ${skippedFields.length} field(s) for "${jobName}": ${skippedFields.join(', ')}`);
        }
        console.log(`📝 Creating job: "${jobName}" with ${Object.keys(filteredFieldData).length} field(s): ${Object.keys(filteredFieldData).join(', ')}`);
        
        // Debug: Check if location reference is in filteredFieldData
        console.log(`\n📋 ===== FINAL FIELD DATA CHECK =====`);
        console.log(`📋 All fields in filteredFieldData: ${Object.keys(filteredFieldData).join(', ')}`);
        if (locationCodeFieldSlug) {
          const locationRefValue = filteredFieldData[locationCodeFieldSlug];
          console.log(`📋 Location reference field "${locationCodeFieldSlug}": ${JSON.stringify(locationRefValue)}`);
          
          if (!locationRefValue) {
            console.error(`❌ ERROR: Location reference field "${locationCodeFieldSlug}" is MISSING from filteredFieldData!`);
            console.error(`   This field should be set as a REFERENCE (array of item IDs) but it's not in the data being sent to Webflow.`);
          } else {
            // Verify it's in the correct format (array of item IDs)
            if (Array.isArray(locationRefValue) && locationRefValue.length > 0) {
              console.log(`✅ Location reference field is present and correctly formatted as REFERENCE (array)`);
              console.log(`✅ Format: [${locationRefValue.join(', ')}] - This is correct for reference fields`);
              console.log(`✅ NOT text - it's a reference to location collection item`);
            } else {
              console.error(`❌ ERROR: Location reference field is NOT in correct format!`);
              console.error(`   Expected: Array of item IDs like ["item-id-123"]`);
              console.error(`   Got: ${typeof locationRefValue} - ${JSON.stringify(locationRefValue)}`);
              console.error(`   Reference fields MUST be arrays, not text!`);
            }
          }
        } else {
          console.warn(`⚠️ locationCodeFieldSlug is not set - cannot verify location reference field`);
        }
        console.log(`📋 ===== END FINAL CHECK =====\n`);

        // Create item in Webflow
        const webflowBody: any = {
          fieldData: filteredFieldData,
          isArchived: false,
          isDraft: false, // Publish immediately (not draft)
        };

        console.log(`📤 Sending to Webflow:`, JSON.stringify(webflowBody, null, 2));
        
        // CRITICAL: Final verification before sending to Webflow
        console.log(`\n📤 ===== FINAL PAYLOAD VERIFICATION =====`);
        console.log(`📤 All fields in webflowBody.fieldData: ${Object.keys(webflowBody.fieldData).join(', ')}`);
        
        if (locationCodeFieldSlug) {
          if (webflowBody.fieldData[locationCodeFieldSlug]) {
            console.log(`✅ Location reference field "${locationCodeFieldSlug}" is included in Webflow payload:`, webflowBody.fieldData[locationCodeFieldSlug]);
            console.log(`✅ Field type: ${Array.isArray(webflowBody.fieldData[locationCodeFieldSlug]) ? 'Array (correct for reference)' : typeof webflowBody.fieldData[locationCodeFieldSlug]}`);
          } else {
            console.error(`\n❌ ERROR: Location reference field "${locationCodeFieldSlug}" is MISSING from Webflow payload!`);
            console.error(`❌ This field should be set but it's not in the data being sent to Webflow.`);
            console.error(`❌ Attempting to add it now...`);
            
            // LAST CHANCE: Try to add it if we have the ID
            if (fieldData['_location_reference_id']) {
              webflowBody.fieldData[locationCodeFieldSlug] = [fieldData['_location_reference_id']];
              console.log(`✅ Added location reference field "${locationCodeFieldSlug}" to payload at last moment:`, webflowBody.fieldData[locationCodeFieldSlug]);
            } else {
              console.error(`❌ Cannot add - no _location_reference_id available`);
            }
          }
        } else {
          console.error(`❌ ERROR: locationCodeFieldSlug is not set - cannot verify location reference field!`);
        }
        console.log(`📤 ===== END PAYLOAD VERIFICATION =====\n`);
        
        // Use /items/live endpoint to create items directly as LIVE (published)
        // This bypasses the draft state and publishes immediately
        const createResponse = await fetch(
          `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/live`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${AUTH_TOKEN}`,
              'accept-version': '2.0.0',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(webflowBody),
          }
        );

        if (!createResponse.ok) {
          let errorText = 'Unknown error';
          let errorDetails: any = null;
          try {
            const errorData = await createResponse.text();
            errorText = errorData.substring(0, 500); // Limit error text
            // Try to parse as JSON to get structured error details
            try {
              errorDetails = JSON.parse(errorData);
            } catch (e) {
              // Not JSON, use as text
            }
            console.error(`❌ Webflow API Error Response:`, errorText);
            
            // If it's a validation error, extract which fields are invalid
            if (errorDetails && errorDetails.details && Array.isArray(errorDetails.details)) {
              const invalidFields = errorDetails.details
                .filter((d: any) => d.param)
                .map((d: any) => d.param)
                .join(', ');
              console.error(`❌ Invalid fields detected: ${invalidFields}`);
              console.error(`⚠️ Available fields in collection: ${availableFields.join(', ')}`);
              
              // Check if location-code field is invalid - this means we should retry with ID instead of name
              const shouldRetryWithId = locationCodeFieldSlug && invalidFields.includes(locationCodeFieldSlug) && fieldData['_location_reference_id'];
              
              if (shouldRetryWithId && locationCodeFieldSlug) {
                console.warn(`\n🔄 ===== LOCATION CODE VALIDATION ERROR DETECTED =====`);
                console.warn(`🔄 The location-code field was rejected when using location code name (e.g., "OL_LOC_0020")`);
                console.warn(`🔄 This likely means it's a reference field that requires item IDs, not text values`);
                console.warn(`🔄 Retrying with location item ID instead...`);
                
                const retryFieldData = { ...filteredFieldData };
                retryFieldData[locationCodeFieldSlug] = [fieldData['_location_reference_id']];
                
                console.log(`🔄 Retrying with location item ID: ${fieldData['_location_reference_id']}`);
                console.log(`🔄 This is the correct format for reference fields in Webflow`);
                
                const retryBody = {
                  fieldData: retryFieldData,
                  isArchived: false,
                  isDraft: false, // Publish immediately (not draft)
                };
                
                const retryResponse = await fetch(
                  `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/live`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${AUTH_TOKEN}`,
                      'accept-version': '2.0.0',
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(retryBody),
                  }
                );
                
                if (retryResponse.ok) {
                  console.log(`✅ Successfully created after retrying with location item ID`);
                  console.log(`✅ Location code name was rejected, but item ID worked (reference field requires IDs)`);
                  // Continue with success path
                  let createdItem: any = null;
                  try {
                    createdItem = await retryResponse.json();
                    console.log(`✅ Successfully created item "${jobName}" with ID: ${createdItem.id || 'unknown'}`);
                    synced++;
                    continue; // Skip to next job
                  } catch (e) {
                    // Still count as success if status was OK
                    synced++;
                    continue;
                  }
                } else {
                  // Retry with ID also failed, log and continue with error
                  const retryErrorText = await retryResponse.text().catch(() => 'Unknown error');
                  console.error(`❌ Retry with ID also failed:`, retryErrorText.substring(0, 200));
                }
              } else if (invalidFields && invalidFields.split(',').length <= 3) {
                // Remove invalid fields and retry (if not too many errors)
                // BUT NEVER remove the location-code reference field - it's critical
                const invalidFieldList = invalidFields.split(',').map((f: string) => f.trim());
                invalidFieldList.forEach((invalidField: string) => {
                  // CRITICAL: Never remove location-code reference field even if Webflow says it's invalid
                  // It might be a false positive or the field slug might be slightly different
                  if (locationCodeFieldSlug && invalidField === locationCodeFieldSlug) {
                    console.warn(`⚠️ Webflow reported location-code field "${invalidField}" as invalid, but keeping it anyway`);
                    console.warn(`   This might be a false positive. Field will be kept in retry.`);
                    return; // Don't remove it
                  }
                  
                  if (filteredFieldData.hasOwnProperty(invalidField)) {
                    console.log(`🗑️ Removing invalid field "${invalidField}" from request`);
                    delete filteredFieldData[invalidField];
                  }
                });
                
                // Retry with cleaned data
                const retryBody = {
                  fieldData: filteredFieldData,
                  isArchived: false,
                  isDraft: false, // Publish immediately (not draft)
                };
                
                console.log(`🔄 Retrying with cleaned field data:`, JSON.stringify(retryBody, null, 2));
                // Use /items/live endpoint to create items directly as LIVE (published)
                const retryResponse = await fetch(
                  `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/live`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${AUTH_TOKEN}`,
                      'accept-version': '2.0.0',
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(retryBody),
                  }
                );
                
                if (retryResponse.ok) {
                  console.log(`✅ Successfully created after removing invalid fields`);
                  // Continue with success path
                  let createdItem: any = null;
                  try {
                    createdItem = await retryResponse.json();
                    console.log(`✅ Successfully created item "${jobName}" with ID: ${createdItem.id || 'unknown'}`);
                    synced++;
                    continue; // Skip to next job
                  } catch (e) {
                    // Still count as success if status was OK
                    synced++;
                    continue;
                  }
                } else {
                  // Retry also failed, log and continue with error
                  const retryErrorText = await retryResponse.text().catch(() => 'Unknown error');
                  console.error(`❌ Retry also failed:`, retryErrorText.substring(0, 200));
                }
              }
            }
          } catch (e) {
            errorText = `HTTP ${createResponse.status}: ${createResponse.statusText}`;
          }
          console.error(`❌ Failed to create job "${jobName}":`, errorText);
          errors.push(`Failed to create job "${jobName}": ${errorText}`);
          continue;
        }

        // Parse the response to verify the item was created
        let createdItem: any = null;
        try {
          createdItem = await createResponse.json();
          console.log(`✅ Successfully created item "${jobName}" with ID: ${createdItem.id || 'unknown'}`);
          
          // Verify the item was actually created by fetching it back
          if (createdItem.id) {
            const verifyResponse = await fetch(
              `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/${createdItem.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${AUTH_TOKEN}`,
                  'accept-version': '2.0.0',
                },
              }
            );
            
            if (verifyResponse.ok) {
              const verifiedItem = await verifyResponse.json();
              console.log(`✅ Verified item exists in CMS: ${verifiedItem.fieldData?.name || jobName}`);
            } else {
              console.warn(`⚠️ Created item but verification failed: ${verifyResponse.status}`);
            }
          }
        } catch (parseError) {
          console.error(`⚠️ Created item but failed to parse response:`, parseError);
          // Still count as synced if status was OK
        }

        synced++;
      } catch (error) {
        const jobName = job.title || job.jobTitle || job.name || 'Unknown';
        errors.push(`Error processing job "${jobName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Unpublish items not in API, publish items that are in API
    console.log(`\n📢 ===== UPDATING PUBLISH STATUS =====`);
    console.log(`📢 Checking ${existingItems.length} existing items against ${jobs.length} API jobs...`);
    
    for (const item of existingItems) {
      // Skip if already archived
      if (item.isArchived) {
        continue;
      }
      
      const itemRequisitionId = item.fieldData?.['requisition-id'] || '';
      const itemName = item.fieldData?.name || item.name || '';
      
      let foundInApi = false;
      
      // Check by requisition-id
      if (itemRequisitionId) {
        foundInApi = apiJobIdentifiers.has(`req:${itemRequisitionId}`);
      }
      
      // Check by name if requisition-id didn't match
      if (!foundInApi && itemName) {
        foundInApi = apiJobIdentifiers.has(`name:${itemName}`);
      }
      
      if (foundInApi) {
        // Item exists in API - ensure it's published
        // Check if item is already published (isDraft: false)
        if (item.isDraft === true) {
          try {
            console.log(`📢 Publishing item: "${itemName || item.id}" (found in API)`);
            
            // Publish the item using /items/live endpoint (same as unarchiving)
            const publishResponse = await fetch(
              `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/live/${item.id}`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${AUTH_TOKEN}`,
                  'accept-version': '2.0.0',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  isDraft: false, // Publish the item
                }),
              }
            );
            
            if (publishResponse.ok) {
              published++;
              console.log(`✅ Successfully published item: "${itemName || item.id}"`);
            } else {
              const errorText = await publishResponse.text().catch(() => 'Unknown error');
              console.warn(`⚠️ Failed to publish item "${itemName || item.id}" (${publishResponse.status}):`, errorText.substring(0, 200));
              errors.push(`Failed to publish item "${itemName || item.id}": ${errorText.substring(0, 100)}`);
            }
          } catch (publishError) {
            console.error(`❌ Error publishing item "${itemName || item.id}":`, publishError);
            errors.push(`Error publishing item "${itemName || item.id}": ${publishError instanceof Error ? publishError.message : 'Unknown error'}`);
          }
        } else {
          // Item is already published, skip
          console.log(`ℹ️ Item already published: "${itemName || item.id}"`);
        }
      } else {
        // Item not found in API - unpublish it (keep in CMS, remove from live site)
        try {
          console.log(`📢 Unpublishing item: "${itemName || item.id}" (not found in API)`);
          
          // Unpublish the item using DELETE /items/{item_id}/live
          const unpublishResponse = await fetch(
            `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/${item.id}/live`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'accept-version': '2.0.0',
              },
            }
          );
          
          if (unpublishResponse.ok) {
            unpublished++;
            console.log(`✅ Successfully unpublished item: "${itemName || item.id}"`);
          } else {
            const errorText = await unpublishResponse.text().catch(() => 'Unknown error');
            // Don't fail if item wasn't published - just log
            if (unpublishResponse.status !== 404) {
              console.warn(`⚠️ Failed to unpublish item "${itemName || item.id}" (${unpublishResponse.status}):`, errorText.substring(0, 200));
              errors.push(`Failed to unpublish item "${itemName || item.id}": ${errorText.substring(0, 100)}`);
            } else {
              console.log(`ℹ️ Item already unpublished: "${itemName || item.id}"`);
              unpublished++; // Count as unpublished even if it was already unpublished
            }
          }
        } catch (unpublishError) {
          console.error(`❌ Error unpublishing item "${itemName || item.id}":`, unpublishError);
          errors.push(`Error unpublishing item "${itemName || item.id}": ${unpublishError instanceof Error ? unpublishError.message : 'Unknown error'}`);
        }
      }
    }
    
    console.log(`📢 ===== PUBLISH STATUS UPDATE COMPLETE =====`);
    console.log(`📢 Unpublished ${unpublished} items, published ${published} items\n`);
    
    // If any items were unpublished or published, trigger a site publish to ensure changes are reflected on live site
    if ((unpublished > 0 || published > 0) && SITE_ID) {
      try {
        console.log(`🚀 Triggering site publish to reflect publish status changes on live site...`);
        const publishResponse = await fetch(
          `https://api.webflow.com/v2/sites/${SITE_ID}/publish`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${AUTH_TOKEN}`,
              'accept-version': '2.0.0',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              domains: [], // Empty array publishes to all domains
            }),
          }
        );
        
        if (publishResponse.ok) {
          console.log(`✅ Successfully triggered site publish - publish status changes are reflected on live site`);
        } else {
          const errorText = await publishResponse.text().catch(() => 'Unknown error');
          console.warn(`⚠️ Site publish failed (${publishResponse.status}):`, errorText.substring(0, 200));
          console.warn(`⚠️ Items publish status updated but may need manual publish in Webflow dashboard`);
          // Don't add to errors - this is non-critical, items publish status is already updated
        }
      } catch (publishError) {
        console.warn(`⚠️ Error triggering site publish:`, publishError);
        console.warn(`⚠️ Items publish status updated but may need manual publish in Webflow dashboard`);
        // Don't add to errors - this is non-critical
      }
    } else if ((unpublished > 0 || published > 0) && !SITE_ID) {
      console.warn(`⚠️ SITE_ID not configured - cannot trigger automatic site publish`);
      console.warn(`⚠️ Please manually publish your site in Webflow dashboard to see publish status changes reflected on live site`);
    }
    
    // Final verification: Count actual items in collection
    let finalItemCount = 0;
    try {
      const finalCheckResponse = await fetch(
        `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`,
        {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'accept-version': '2.0.0',
          },
        }
      );
      
      if (finalCheckResponse.ok) {
        const finalData = await finalCheckResponse.json();
        finalItemCount = finalData.items?.length || 0;
        console.log(`📊 Final item count in collection: ${finalItemCount} (was ${existingItems.length} before sync)`);
      }
    } catch (e) {
      console.error('Error verifying final item count:', e);
    }
    
    console.log(`✅ Sync completed: ${synced} jobs synced, ${skipped} skipped, ${unpublished} unpublished, ${published} published, ${unarchived} unarchived in collection "${collectionName}" (${COLLECTION_ID})`);
    
    const responseMessage = `Sync completed: ${synced} jobs synced to "${collectionName}", ${skipped} skipped, ${unpublished} unpublished, ${published} published, ${unarchived} unarchived`;
    
    return NextResponse.json({
      success: true,
      message: responseMessage,
      synced,
      skipped,
      unpublished,
      published,
      unarchived,
      total: jobs.length,
      totalAvailable: originalJobCount,
      collectionId: COLLECTION_ID,
      collectionName: collectionName,
      itemsBeforeSync: existingItems.length,
      itemsAfterSync: finalItemCount,
      itemsAdded: finalItemCount - existingItems.length,
      availableFields: availableFields, // Include available fields in response
      fieldCount: availableFields.length,
      apiFields: {
        allFields: allApiFields,
        fieldDetails: fieldDetails,
        totalFields: allApiFields.length
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to preview what would be synced
export async function GET() {
  try {
    console.log(`👁️ Preview sync to Webflow Collection ID: ${COLLECTION_ID}`);
    
    // Fetch location mapping for reference fields
    const { map: locationMap } = await fetchLocationMapping();
    
    // First, fetch collection structure to see available fields
    let availableFields: string[] = [];
    let collectionName = 'Unknown';
    try {
      const collectionResponse = await fetch(
        `https://api.webflow.com/v2/collections/${COLLECTION_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'accept-version': '2.0.0',
          },
        }
      );

      if (collectionResponse.ok) {
        const collectionData = await collectionResponse.json();
        collectionName = collectionData.displayName || collectionData.name || 'Unknown';
        const allFieldDetails = collectionData.fields || [];
        availableFields = allFieldDetails.map((field: any) => field.slug || field.id);
        console.log(`✅ Collection found: "${collectionName}" with ${availableFields.length} fields`);
        console.log(`📋 Available field slugs:`, availableFields.join(', '));
        // Log field details for debugging
        allFieldDetails.forEach((field: any) => {
          console.log(`  - ${field.slug || field.id}: ${field.displayName || field.name || 'unnamed'} (${field.type || 'unknown type'})`);
        });
      }
    } catch (collectionError) {
      console.error('Error fetching collection structure:', collectionError);
      // Continue even if collection fetch fails
    }

    // Fetch data from external API with retry logic
    let externalResponse: Response | undefined;
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        console.log(`[GET] Attempting to fetch external API (attempt ${attempt}/${maxRetries})...`);
        
        externalResponse = await fetch(EXTERNAL_API_URL, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; WebflowSync/1.0)',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // If we got a 5xx error, retry (unless it's the last attempt)
        if (!externalResponse.ok && externalResponse.status >= 500 && attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`[GET] API returned ${externalResponse.status}, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Success or non-retryable error, break out of retry loop
        break;
      } catch (fetchError: any) {
        lastError = fetchError;
        console.error(`[GET] Error fetching external API (attempt ${attempt}/${maxRetries}):`, fetchError);
        
        // If it's a timeout or network error and not the last attempt, retry
        if ((fetchError.name === 'AbortError' || fetchError.message?.includes('fetch')) && attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[GET] Network error, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Last attempt or non-retryable error
        if (attempt === maxRetries) {
          const errorMessage = fetchError.name === 'AbortError' 
            ? 'Request timeout - the external API took too long to respond after multiple attempts'
            : fetchError instanceof Error ? fetchError.message : 'Network error';
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to fetch from external API after multiple attempts',
              details: errorMessage,
            },
            { status: 500 }
          );
        }
      }
    }

    // Check if externalResponse is defined before accessing its properties
    if (!externalResponse) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch from external API - no response received after multiple attempts',
          details: 'The external API did not return a response. Please try again later.',
        },
        { status: 500 }
      );
    }

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text().catch(() => 'Unknown error');
      console.error('[GET] External API error after retries:', externalResponse.status, errorText.substring(0, 200));
      
      // Provide helpful error messages based on status code
      let userFriendlyMessage = '';
      if (externalResponse.status === 500) {
        userFriendlyMessage = 'The external API server is experiencing issues. We tried multiple times but the server is still returning errors. Please try again later or contact the API provider.';
      } else if (externalResponse.status === 404) {
        userFriendlyMessage = 'The API endpoint was not found. Please check if the API URL is correct.';
      } else if (externalResponse.status === 403) {
        userFriendlyMessage = 'Access forbidden. The API may require authentication or have access restrictions.';
      } else if (externalResponse.status >= 500) {
        userFriendlyMessage = 'The external API server is down or experiencing issues. We tried multiple times but the server is still returning errors. Please try again later.';
      } else {
        userFriendlyMessage = `The external API returned an error (${externalResponse.status}).`;
      }
      
      return NextResponse.json(
        {
          success: false,
          error: userFriendlyMessage,
          details: `HTTP ${externalResponse.status}: ${externalResponse.statusText} (after ${maxRetries} attempts)`,
          technicalDetails: errorText.substring(0, 200),
        },
        { status: 200 } // Return 200 so frontend can display the error message
      );
    }

    // Check if response is actually JSON
    const contentType = externalResponse.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    
    let externalData;
    try {
      if (isJson) {
        externalData = await externalResponse.json();
      } else {
        // Response is not JSON (likely HTML error page)
        const textResponse = await externalResponse.text();
        console.error('External API returned non-JSON response:', textResponse.substring(0, 200));
        
        // Check if it's an HTML error page
        if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
          return NextResponse.json(
            {
              success: false,
              error: 'The external API returned an HTML error page instead of JSON. The API server may be down or experiencing issues.',
              details: `HTTP ${externalResponse.status}: ${externalResponse.statusText}`,
              technicalDetails: 'Response appears to be an HTML error page (likely from Cloudflare or server error page)',
            },
            { status: 200 }
          );
        }
        
        // Try to parse as JSON anyway (in case content-type is wrong)
        try {
          externalData = JSON.parse(textResponse);
        } catch (e) {
          return NextResponse.json(
            {
              success: false,
              error: 'The external API returned an invalid response format',
              details: `HTTP ${externalResponse.status}: ${externalResponse.statusText}`,
              technicalDetails: textResponse.substring(0, 500),
            },
            { status: 200 }
          );
        }
      }
    } catch (parseError) {
      console.error('Error parsing external API response:', parseError);
      const textResponse = await externalResponse.text();
      
      // Check if it's HTML
      if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
        return NextResponse.json(
          {
            success: false,
            error: 'The external API returned an HTML error page instead of JSON. The API server may be down or experiencing issues.',
            details: `HTTP ${externalResponse.status}: ${externalResponse.statusText}`,
            technicalDetails: 'Response appears to be an HTML error page (likely from Cloudflare or server error page)',
          },
          { status: 200 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON response from external API',
          details: textResponse.substring(0, 500), // First 500 chars
        },
        { status: 500 }
      );
    }
    
    // Handle different response formats
    let jobs: any[] = [];
    if (Array.isArray(externalData)) {
      jobs = externalData;
    } else if (externalData.jobs && Array.isArray(externalData.jobs)) {
      jobs = externalData.jobs;
    } else if (externalData.data && Array.isArray(externalData.data)) {
      jobs = externalData.data;
    } else if (externalData.items && Array.isArray(externalData.items)) {
      jobs = externalData.items;
    } else {
      jobs = [externalData];
    }

    // Extract and log all fields from API data
    const { fields: allApiFields, fieldDetails } = extractAllFieldsFromApiData(jobs);
    console.log(`📊 API Data Analysis: Found ${allApiFields.length} unique fields in ${jobs.length} job(s)`);
    console.log(`📋 All API fields:`, allApiFields.join(', '));
    
    // Log detailed field information
    console.log(`\n📊 Detailed Field Information:`);
    allApiFields.forEach((field) => {
      const details = fieldDetails[field];
      const sampleValue = details.sampleValue;
      let sampleStr = '';
      
      if (sampleValue === null || sampleValue === undefined) {
        sampleStr = String(sampleValue);
      } else if (typeof sampleValue === 'object') {
        sampleStr = Array.isArray(sampleValue) 
          ? `[${sampleValue.length} items]`
          : `{${Object.keys(sampleValue).join(', ')}}`;
      } else if (typeof sampleValue === 'string' && sampleValue.length > 50) {
        sampleStr = sampleValue.substring(0, 50) + '...';
      } else {
        sampleStr = String(sampleValue);
      }
      
      console.log(`  - ${field}: ${details.type} (found in ${details.count}/${jobs.length} items) | Sample: ${sampleStr}`);
    });
    console.log(''); // Empty line for readability

    // Get existing items to check for duplicates
    const existingItemsResponse = await fetch(
      `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'accept-version': '2.0.0',
        },
      }
    );

    let existingItems: any[] = [];
    if (existingItemsResponse.ok) {
      try {
        const existingData = await existingItemsResponse.json();
        existingItems = existingData.items || [];
        console.log(`📋 Found ${existingItems.length} existing items in collection`);
      } catch (e) {
        console.error('Error parsing existing items:', e);
        // Continue with empty array if parsing fails
      }
    } else {
      console.error(`❌ Failed to fetch existing items: ${existingItemsResponse.status}`);
      // Continue with empty array - will show all as new
    }

    // Helper function to extract string from value (handles objects)
    const extractString = (value: any): string => {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object') {
        return value.name || value.location_name || value.address || value.companyName || 
               value.organization || value.employerName || value.city || 
               value.location_description || '';
      }
      return '';
    };

    // Preview what would be synced
    const preview = jobs.map((job) => {
      const jobName = job.title || job.jobTitle || job.name || 'Untitled';
      const jobUrl = job.url || job.applyUrl || job.link || '';
      
      const exists = existingItems.some((item: any) => {
        const itemName = item.fieldData?.name || '';
        const itemUrl = item.fieldData?.['ticket-link'] || '';
        return (jobName && itemName === jobName) || (jobUrl && itemUrl === jobUrl);
      });

      return {
        name: jobName,
        company: extractString(job.company) || extractString(job.employer) || '',
        location: extractString(job.location) || extractString(job.address) || '',
        url: jobUrl,
        willSync: !exists,
        mappedFields: mapJobToWebflowFields(job, locationMap),
      };
    });

    return NextResponse.json({
      success: true,
      total: jobs.length,
      new: preview.filter((p) => p.willSync).length,
      existing: preview.filter((p) => !p.willSync).length,
      preview,
      collectionId: COLLECTION_ID,
      collectionName: collectionName,
      availableFields, // Include available fields for debugging
      fieldCount: availableFields.length,
      apiFields: {
        allFields: allApiFields,
        fieldDetails: fieldDetails,
        totalFields: allApiFields.length
      },
    });
  } catch (error) {
    console.error('Error in GET /api/sync-jobs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch jobs preview',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}


