# Events CMS - Webflow Integration

A modern Next.js application for managing Webflow Events collection with a beautiful dark theme UI.

## Features

- ✅ **Event Management**: Create and edit events with rich text support
- ✅ **Multi-Select References**: Manage event communities, categories, and locations
- ✅ **Dark Theme**: Modern, professional dark UI inspired by contemporary event platforms
- ✅ **Real-time Sync**: Direct integration with Webflow CMS API
- ✅ **Rich Text Editor**: Full-featured editor for event descriptions
- ✅ **Image Upload**: Drag-and-drop image uploads with live preview (ImgBB integration)

## Tech Stack

- **Framework**: Next.js 15.3.3
- **Language**: TypeScript
- **Image Hosting**: ImgBB API
- **Styling**: CSS Modules with custom dark theme
- **API**: Webflow CMS API v2
- **Deployment**: Netlify

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Webflow account with API access
- Webflow site with Events collection set up

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd gathering-cms-projects
```

2. Install dependencies:
```bash
npm install
```

3. Configure Webflow credentials:
```bash
# Copy the example config
cp config.example.ts config.ts

# Edit config.ts with your actual Webflow credentials
```

4. Update `config.ts` with your Webflow API credentials:
```typescript
export const AUTH_TOKEN = 'your_webflow_api_token';
export const COLLECTION_ID = 'your_events_collection_id';
export const LOCATION_COLLECTION_ID = 'your_location_collection_id';
export const SITE_ID = 'your_webflow_site_id';
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Deployment to Netlify

### Quick Deploy

1. **Push to GitHub**:
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Connect to Netlify**:
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Select your Git provider and repository
   - Netlify will auto-detect Next.js settings

3. **Environment Variables** (⚠️ IMPORTANT):
   - In Netlify dashboard, go to: Site settings → Environment variables
   - Add the following variables:
     - **Webflow:**
       - `NEXT_PUBLIC_AUTH_TOKEN`: Your Webflow API token
       - `NEXT_PUBLIC_COLLECTION_ID`: Your Events collection ID
       - `NEXT_PUBLIC_LOCATION_COLLECTION_ID`: Your Location collection ID
       - `NEXT_PUBLIC_SITE_ID`: Your Webflow site ID
     - **Image Hosting (Optional):**
       - `IMGBB_API_KEY`: Your ImgBB API key (see [IMGBB_SETUP.md](./IMGBB_SETUP.md))
   
   ⚠️ **Without these environment variables, the deployment will fail or not work properly**

4. **Deploy**:
   - Click "Deploy site"
   - Netlify will build and deploy automatically

### Manual Deploy

```bash
# Build the project
npm run build

# The build output will be in .next/
# Netlify will automatically deploy this
```

## Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── collection/         # Main collection API
│   │   ├── locations/          # Location collection API
│   │   └── collection/items/   # Item CRUD operations
│   ├── components/             # React components
│   │   ├── EditItemModal.tsx   # Edit event modal
│   │   ├── MultiSelectBadge.tsx # Multi-select with badges
│   │   └── RichTextEditor.tsx  # Rich text editor
│   ├── sync-jobs/              # Sync jobs page
│   ├── page.tsx                # Main events list page
│   └── globals.css             # Global styles
├── config.ts                   # Webflow API configuration
├── netlify.toml                # Netlify configuration
└── README.md                   # This file
```

## Webflow Collection Structure

Your Webflow Events collection should have these fields:

- `name` (PlainText, Required) - Event Name
- `slug` (PlainText, Required) - URL Slug
- `description` (PlainText) - Event Description
- `club-name` (PlainText) - Club Name
- `event-organiser-name` (PlainText) - Organiser Name
- `date-and-time` (DateTime) - Event Date/Time
- `address` (PlainText) - Event Address
- `thumbnail` (Image) - Event Thumbnail
- `ticket-link` (Link) - Ticket Purchase Link
- `featured-image` (Switch) - Featured Flag
- `order` (Number) - Sort Order
- `location` (Reference) - Location Reference
- `event-community` (MultiReference) - Event Communities
- `places-2` (MultiReference) - Categories

## Security Notes

⚠️ **NEVER commit `config.ts` with real credentials!**

- The `config.ts` file is ignored by git
- Use Netlify environment variables for production
- Keep your Webflow API token secure
- Regularly rotate your API tokens

## Support

For issues or questions:
1. Check Webflow API documentation: https://developers.webflow.com/
2. Review Next.js documentation: https://nextjs.org/docs
3. Check Netlify documentation: https://docs.netlify.com/

## License

Private project - All rights reserved
