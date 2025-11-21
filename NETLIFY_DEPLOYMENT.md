# Netlify Deployment Guide

This guide will help you deploy your Gathering CMS application to Netlify.

## Prerequisites

- ✅ GitHub account
- ✅ Netlify account (free tier is fine)
- ✅ Your Webflow API credentials
- ✅ Your ImgBB API key

## Step 1: Prepare Your Repository

### 1.1 Commit All Changes

```bash
git add .
git commit -m "Prepare for Netlify deployment"
git push origin main
```

### 1.2 Verify .gitignore

Make sure `.env.local` is in your `.gitignore` (it already is! ✅)

## Step 2: Create Netlify Site

### Option A: Deploy via Netlify Dashboard

1. **Go to Netlify**: https://app.netlify.com/
2. **Click "Add new site"** → "Import an existing project"
3. **Connect to GitHub** and select your repository
4. **Configure build settings**:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Base directory: (leave empty)

### Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize and deploy
netlify init

# Deploy
netlify deploy --prod
```

## Step 3: Configure Environment Variables

In your Netlify dashboard:

1. **Go to**: Site settings → Environment variables
2. **Add all variables** from your `.env.local`:

### Required Environment Variables:

```
NEXT_PUBLIC_AUTH_TOKEN=89d5a0a7ce86998b8a71039c802bbed0b05796d9986d5e60aede37b2cd22d3c2
NEXT_PUBLIC_COLLECTION_ID=686b88dfd246d066e6c034f8
NEXT_PUBLIC_CATEGORY_COLLECTION_ID=686b89fba5b90558f5ce471f
NEXT_PUBLIC_COMMUNITY_COLLECTION_ID=68e70edb8c0ca22e35eccd27
NEXT_PUBLIC_LOCATION_COLLECTION_ID=686b87fd7142a7a251518c48
NEXT_PUBLIC_SITE_ID=6865ac77d1a4f0d42c02ccbf

IMGBB_API_KEY=df2bb71915b7c58cbcbdc8e00a41d668
```

### How to Add Variables:

1. Click **"Add a variable"**
2. Enter **Key** and **Value**
3. Select **"Same value for all deploy contexts"** (or customize per environment)
4. Click **"Create variable"**
5. Repeat for all variables

## Step 4: Trigger Deployment

After adding all environment variables:

1. **Go to "Deploys"** tab
2. **Click "Trigger deploy"** → "Clear cache and deploy site"
3. **Wait for build** (usually 2-3 minutes)

## Step 5: Verify Deployment

Once deployed, test these features:

### ✅ Checklist:

- [ ] Can access the site at your Netlify URL
- [ ] Can view events list
- [ ] Can create a new event
- [ ] **Image upload works** (uploads to ImgBB)
- [ ] Can edit existing events
- [ ] Can save changes successfully
- [ ] Images display correctly
- [ ] All API calls work

### Test Image Upload:

1. Go to "Add Event"
2. Fill in required fields
3. Select an image
4. Click "Create Event"
5. Check console logs - should see:
   ```
   📤 Uploading to ImgBB...
   ✅ ImgBB upload successful!
   ```

## Step 6: Custom Domain (Optional)

To use your own domain:

1. **Go to**: Domain settings
2. **Click "Add custom domain"**
3. **Enter your domain**
4. **Update DNS** records as shown
5. **Enable HTTPS** (automatic with Let's Encrypt)

## Troubleshooting

### Build Fails

**Check build logs** in Netlify dashboard:

```bash
# Common issues:
- Missing environment variables
- TypeScript errors
- Missing dependencies
```

**Solution**: 
- Verify all env vars are set
- Check logs for specific errors
- Ensure `package.json` has all dependencies

### Environment Variables Not Working

**Problem**: Variables showing as `undefined`

**Solution**:
1. Variables starting with `NEXT_PUBLIC_` are available client-side
2. Other variables are server-side only
3. Redeploy after adding variables
4. Clear cache and redeploy

### Image Upload Fails

**Check**:
- ImgBB API key is set correctly
- Console shows: `Using API key: ✅ Configured`
- Network tab shows successful upload to ImgBB

**Solution**:
```bash
# Verify in Netlify:
IMGBB_API_KEY=df2bb71915b7c58cbcbdc8e00a41d668
```

## Monitoring & Logs

### View Logs:

1. **Build logs**: Deploys → Click on a deploy → View logs
2. **Function logs**: Functions → Select function → View logs
3. **Real-time logs**: Install Netlify CLI and run:
   ```bash
   netlify logs:functions
   ```

### Analytics:

Netlify provides free analytics:
- Page views
- Unique visitors
- Top pages
- Bandwidth usage

## Performance Optimization

### Enable These Features:

1. **Asset optimization**: Enabled by default
2. **Image optimization**: Already using ImgBB CDN
3. **Build cache**: Configured in `netlify.toml`
4. **CDN**: Global edge network (automatic)

### Recommended Settings:

```toml
# In netlify.toml (already configured!)
[build.environment]
  NODE_VERSION = "18"
  NEXT_PRIVATE_STANDALONE = "true"
```

## Cost Estimate

### Netlify Free Tier Includes:

- ✅ 100 GB bandwidth/month
- ✅ 300 build minutes/month
- ✅ Automatic HTTPS
- ✅ Continuous deployment
- ✅ Form submissions (100/month)
- ✅ Identity users (1,000 MAU)

**Your app should fit comfortably in the free tier!**

## Next Steps After Deployment

1. ✅ Test all functionality
2. ✅ Set up custom domain (optional)
3. ✅ Monitor performance and errors
5. ✅ Set up deployment notifications
6. ✅ Create staging environment (optional)

## Quick Deploy Checklist

Before each deployment:

- [ ] All environment variables configured
- [ ] Code committed and pushed to GitHub
- [ ] ImgBB API key valid
- [ ] Build succeeds locally (`npm run build`)
- [ ] No TypeScript errors
- [ ] All dependencies installed

## Support

- **Netlify Docs**: https://docs.netlify.com/
- **Next.js on Netlify**: https://docs.netlify.com/frameworks/next-js/
- **Netlify Support**: https://www.netlify.com/support/

## Your Site URLs

After deployment, you'll get:

- **Main site**: `https://your-project-name.netlify.app`
- **Deploy previews**: `https://deploy-preview-XX--your-project.netlify.app`
- **Branch deploys**: `https://branch-name--your-project.netlify.app`

## Congratulations! 🎉

Your Gathering CMS is now live on Netlify!

Next: Share your site URL and start managing events! 🚀

