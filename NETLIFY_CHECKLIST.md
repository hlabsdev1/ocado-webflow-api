# Netlify Deployment Checklist

Use this checklist to ensure your project is ready for Netlify deployment.

## Pre-Deployment Checklist

### ✅ Configuration Files
- [x] `netlify.toml` configured with correct build settings
- [x] `@netlify/plugin-nextjs` added to `package.json`
- [x] Node version set to 20 in `netlify.toml`
- [x] `.gitignore` includes `.env.local`, `config.ts`, `.next/`, `node_modules/`
- [x] `next.config.ts` optimized for Netlify

### 📦 Dependencies
- [ ] Run `npm install` to install `@netlify/plugin-nextjs`
- [ ] Verify all dependencies are in `package.json`
- [ ] Test build locally: `npm run build`

### 🔐 Environment Variables
Before deploying, ensure these are set in Netlify Dashboard (Site settings → Environment variables):

**Required:**
- [ ] `NEXT_PUBLIC_AUTH_TOKEN` - Webflow API token
- [ ] `NEXT_PUBLIC_COLLECTION_ID` - Main collection ID
- [ ] `NEXT_PUBLIC_LOCATION_COLLECTION_ID` - Location collection ID
- [ ] `NEXT_PUBLIC_SITE_ID` - Webflow site ID

**Optional:**
- [ ] `IMGBB_API_KEY` - For image uploads (if using ImgBB)

### 🚀 Deployment Steps

1. **Commit and Push:**
   ```bash
   git add .
   git commit -m "Prepare for Netlify deployment"
   git push origin main
   ```

2. **Connect to Netlify:**
   - Go to https://app.netlify.com/
   - Click "Add new site" → "Import an existing project"
   - Connect your Git repository
   - Netlify will auto-detect settings from `netlify.toml`

3. **Set Environment Variables:**
   - Go to Site settings → Environment variables
   - Add all required variables listed above
   - Click "Save"

4. **Deploy:**
   - Netlify will automatically trigger a build
   - Or click "Trigger deploy" → "Clear cache and deploy site"

5. **Verify:**
   - [ ] Build succeeds (check Deploys tab)
   - [ ] Site is accessible at `https://your-site.netlify.app`
   - [ ] API routes work correctly
   - [ ] Image uploads work (if configured)
   - [ ] All features function as expected

### 🔍 Post-Deployment Verification

- [ ] Homepage loads correctly
- [ ] API endpoints respond (test `/api/collection`)
- [ ] Can create/edit items
- [ ] Images display correctly
- [ ] No console errors in browser
- [ ] No build errors in Netlify logs

### 🐛 Troubleshooting

**Build Fails:**
- Check build logs in Netlify dashboard
- Verify all environment variables are set
- Ensure `@netlify/plugin-nextjs` is installed
- Test build locally first: `npm run build`

**Environment Variables Not Working:**
- Variables must start with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding variables
- Clear cache and redeploy if needed

**API Routes Not Working:**
- Verify `@netlify/plugin-nextjs` is installed
- Check that API routes are in `app/api/` directory
- Review Netlify function logs

### 📝 Notes

- The `@netlify/plugin-nextjs` plugin automatically handles:
  - Next.js routing
  - API routes (serverless functions)
  - Image optimization
  - ISR (Incremental Static Regeneration)
  
- Build time: Typically 2-5 minutes
- Free tier includes: 100 GB bandwidth/month, 300 build minutes/month

---

**Ready to deploy?** Follow the steps above and your site will be live on Netlify! 🎉

