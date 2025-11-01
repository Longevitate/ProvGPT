# Deploy to Render.com (Quick Test)

This will prove whether Azure is the problem.

## Steps (5-10 minutes):

1. **Sign up**: https://render.com (free tier)

2. **New Web Service**:
   - Click "New +" → "Web Service"
   - Connect GitHub: `Longevitate/ProvGPT`
   - Settings:
     - **Name**: `providence-mcp`
     - **Region**: Oregon (US West)
     - **Branch**: `main`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `node dist/server.js`
     - **Plan**: Free

3. **Deploy** (takes ~3 min)

4. **Get URL**: `https://providence-mcp.onrender.com`

5. **Test in ChatGPT**:
   - Delete Azure app
   - Create new app with Render URL: `https://providence-mcp.onrender.com/mcp`
   - Test ping_v1

## If It Works on Render:
→ Azure is the problem. Switch to Render or debug Azure networking.

## If It Still Fails on Render:
→ OpenAI platform issue. Contact OpenAI support with:
- Your working curl tests
- 424 errors from ChatGPT
- All implemented fixes
- Request support ticket investigation

