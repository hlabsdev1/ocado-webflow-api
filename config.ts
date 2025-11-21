// Configuration for Webflow API and other services
// In production (Netlify), these MUST be set via environment variables
// This file is safe to commit - it only uses environment variables

export const AUTH_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';
export const COLLECTION_ID = process.env.NEXT_PUBLIC_COLLECTION_ID || '';
export const LOCATION_COLLECTION_ID = process.env.NEXT_PUBLIC_LOCATION_COLLECTION_ID || '';
export const SITE_ID = process.env.NEXT_PUBLIC_SITE_ID || '';

// Image hosting configuration - ImgBB
// Get your free API key at https://api.imgbb.com/
// Set IMGBB_API_KEY environment variable in Netlify
export const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';

