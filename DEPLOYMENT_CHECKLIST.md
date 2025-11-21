# Netlify Deployment Readiness Checklist

## ✅ Pre-Deployment Checklist

### 1. Configuration Files
- [x] `config.ts` exists and uses environment variables only (no hardcoded credentials)
- [x] `config.ts` is NOT in `.gitignore` (needs to be committed)
- [x] `netlify.toml` is properly configured
- [x] `package.json` has `@netlify/plugin-nextjs` (latest version: 5.14.7)
- [x] `next.config.ts` is optimized for Netlify

### 2. Dependencies
- [x] All dependencies are in `package.json`
- [x] `@netlify/plugin-nextjs` version is up to date (5.14.7)
- [x] Next.js version is compatible (15.3.3)
- [x] Node version is set to 20 in `netlify.toml`

### 3. Project Structure
- [x] `config.ts` is in the root directory
- [x] All API routes import from correct config path
- [x] No empty directories (categories, communities removed)
- [x] `next-env.d.ts` is NOT in `.gitignore` (needed for TypeScript)

### 4. Environment Variables (Set in Netlify Dashboard)
Required variables:
- [ ] `NEXT_PUBLIC_AUTH_TOKEN` - Webflow API token
- [ ] `NEXT_PUBLIC_COLLECTION_ID` - Main collection ID
- [ ] `NEXT_PUBLIC_LOCATION_COLLECTION_ID` - Location collection ID
- [ ] `NEXT_PUBLIC_SITE_ID` - Webflow site ID

Optional variables:
- [ ] `IMGBB_API_KEY` - For image uploads (if using)

### 5. Git Repository
- [ ] `config.ts` is committed to git
- [ ] `.gitignore` is properly configured
- [ ] All changes are committed and pushed
- [ ] No sensitive data in committed files

## 📋 Files That MUST Be Committed

These files must be in your git repository for Netlify to build:

1. ✅ `config.ts` - Configuration file (uses env vars only)
2. ✅ `package.json` - Dependencies
3. ✅ `netlify.toml` - Netlify configuration
4. ✅ `next.config.ts` - Next.js configuration
5. ✅ `tsconfig.json` - TypeScript configuration
6. ✅ All API route files in `app/api/`
7. ✅ All component files in `app/components/`
8. ✅ `app/layout.tsx`, `app/page.tsx`, etc.
9. ✅ `next-env.d.ts` - TypeScript definitions (auto-generated)

## 🚫 Files That Should NOT Be Committed

These are in `.gitignore`:
- `.env.local` and other `.env*` files
- `node_modules/`
- `.next/`
- `.netlify/`
- Build artifacts

## 🔍 Verification Steps

### Before Pushing to Git:

1. **Test Build Locally:**
   ```bash
   npm install
   npm run build
   ```
   - Should complete without errors
   - Check for any TypeScript errors
   - Verify all imports resolve correctly

2. **Check Git Status:**
   ```bash
   git status
   ```
   - `config.ts` should be tracked (not ignored)
   - No sensitive files should be staged

3. **Verify Config File:**
   - Open `config.ts`
   - Ensure it only uses `process.env.*` (no hardcoded credentials)
   - All values should default to empty strings `''`

### After Pushing to Netlify:

1. **Check Build Logs:**
   - Go to Netlify Dashboard → Deploys
   - Click on the latest deploy
   - Verify build completes successfully
   - Check for any module resolution errors

2. **Verify Environment Variables:**
   - Go to Site settings → Environment variables
   - Ensure all required variables are set
   - Check that values are correct

3. **Test Deployed Site:**
   - Visit your Netlify URL
   - Test API endpoints
   - Verify all features work

## 🐛 Common Issues & Solutions

### Issue: "Module not found: Can't resolve 'config'"
**Solution:**
- Ensure `config.ts` is committed to git
- Check that `config.ts` is NOT in `.gitignore`
- Verify file exists in root directory

### Issue: "Outdated plugin warning"
**Solution:**
- Update `@netlify/plugin-nextjs` in `package.json`
- Current version: `^5.14.7`

### Issue: "Environment variables not working"
**Solution:**
- Verify variables are set in Netlify dashboard
- Ensure variable names match exactly (case-sensitive)
- Redeploy after adding/changing variables

### Issue: "Build fails with TypeScript errors"
**Solution:**
- Ensure `next-env.d.ts` is NOT in `.gitignore`
- Run `npm run build` locally to catch errors
- Fix any TypeScript errors before pushing

## 📝 Final Steps Before Deployment

1. ✅ Run `npm install` to ensure dependencies are up to date
2. ✅ Run `npm run build` locally - must succeed
3. ✅ Verify `config.ts` is committed: `git status config.ts`
4. ✅ Commit all changes: `git add . && git commit -m "Ready for Netlify deployment"`
5. ✅ Push to repository: `git push origin main`
6. ✅ Set environment variables in Netlify dashboard
7. ✅ Trigger deployment in Netlify (or wait for auto-deploy)

## ✅ Current Project Status

Based on the review:

- ✅ `config.ts` - Safe to commit (uses env vars only)
- ✅ `package.json` - Has latest Netlify plugin (5.14.7)
- ✅ `netlify.toml` - Properly configured
- ✅ `.gitignore` - Correctly configured
- ✅ All API routes - Import paths are correct
- ✅ Empty directories - Removed (categories, communities)

**Your project is ready for Netlify deployment!** 🚀

Just ensure:
1. `config.ts` is committed to git
2. All environment variables are set in Netlify
3. Push your changes and deploy!

