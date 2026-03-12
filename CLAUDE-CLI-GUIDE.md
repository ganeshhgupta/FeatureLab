# FeatureLab: Complete Claude CLI Build Guide

## Quick Start (One-Shot MVP Build)

### Option 1: Full Autonomous Build (Recommended)
```bash
claude --file featurelab-build.prompt --execute-all --no-confirm --verbose
```

This will:
- Create entire project structure
- Setup backend (FastAPI + Python)
- Setup frontend (Next.js + React)
- Initialize database (Neon)
- Configure all APIs (Gemini, Pinecone)
- Start both servers
- Generate deployment configs
- Display status report

**Time**: ~10-15 minutes (includes npm install, pip install, build)

---

### Option 2: Interactive Step-by-Step Build
```bash
claude --file featurelab-build.prompt --interactive
```

Walks through each stage and asks for confirmation at key checkpoints.

---

## Version Mismatch Fixer

### Run Complete Audit & Fix
```bash
claude --file fix-all-versions.prompt --execute-all
```

This will:
- Scan package.json, requirements.txt, Dockerfile, etc.
- Identify ALL version conflicts
- Check security vulnerabilities
- Generate fixed package.json
- Generate fixed requirements.txt
- Create runtime.txt and .nvmrc
- Output RESOLUTION_NOTES.md
- Create automated FIX_SCRIPT.sh

**Output**: 
- `backend/requirements.txt` (fixed)
- `frontend/package.json` (fixed)
- `RESOLUTION_NOTES.md` (detailed report)
- `FIX_SCRIPT.sh` (automated fixing)

---

## Bulk Image Processing

### Process WhatsApp Screenshots
```bash
claude code --upload-glob "*.jpeg" --auto-recognize-type --context "Process WhatsApp images - extract timestamps, analyze content, generate metadata"
```

Or in Claude app:
1. Attach all 5-6 images
2. Use this prompt:

```
Use this prompt for image analysis:
```
I have 5-6 WhatsApp screenshot images. Please:

1. Parse filenames to extract dates and times
2. Analyze content (OCR, extract text, identify charts/data)
3. Categorize each image (screenshot, chart, conversation, diagram)
4. Generate image_metadata.json with:
   - filename, timestamp, content_type, extracted_text, analysis
5. Create image_analysis_report.txt with:
   - Total images, date range, content breakdown, key findings
6. If any images contain data tables, extract as CSV

Output:
- processed_images/image_metadata.json
- processed_images/image_analysis_report.txt
- processed_images/extracted_data.csv (if applicable)
```
```

**Output**:
- `processed_images/image_metadata.json`
- `processed_images/image_analysis_report.txt`
- `processed_images/extracted_data.csv`

---

## Deployment Commands

### Deploy to Vercel (Frontend)
```bash
cd frontend
vercel --prod
```

### Deploy to Render (Backend)
```bash
cd backend
git push origin main
# Then in Render dashboard:
# - New Web Service
# - Connect your repo
# - Set environment variables
# - Deploy
```

### Deploy Both (via GitHub)
```bash
git push origin main  # Triggers Vercel (frontend) and Render (backend)
```

---

## Local Development

### Terminal 1: Backend
```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

### Terminal 3: Monitor
```bash
watch -n 1 'ps aux | grep -E "uvicorn|next"'
```

Then visit:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Project URLs After Deployment

### Vercel Frontend
```
https://featurelab-[your-vercel-domain].vercel.app
```

### Render Backend API
```
https://featurelab-backend-[your-render-domain].onrender.com
```

Update `NEXT_PUBLIC_API_URL` in frontend .env.local to backend URL after deployment.

---

## Environment Variables

### Backend (.env or Render dashboard)
```
DATABASE_URL=postgresql://neondb_owner:npg_kYT2ox1tfRFH@ep-proud-cake-adyer1to-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
PINECONE_API_KEY=pcsk_6um2Ah_7pZ8QtW5YPMcGNfsFHJ9okWP8ZmuF93jQWcUPgXgQka5Uf7a6vwMefkTJGpobif
GEMINI_API_KEY=AIzaSyBRMLbZiwsiOtbKUzLLYxC4TKbiQKmVmH4
PINECONE_INDEX=featurelab-prod
```

### Frontend (.env.local or Vercel dashboard)
```
NEXT_PUBLIC_API_URL=https://featurelab-backend-[domain].onrender.com
NEXT_PUBLIC_GEMINI_KEY=AIzaSyBRMLbZiwsiOtbKUzLLYxC4TKbiQKmVmH4
```

---

## Testing the Agent

### Upload Sample CSV
```bash
curl -X POST http://localhost:8000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_path": "sample.csv",
    "target_column": "click",
    "feature_columns": ["I1", "I2", "I3", "C1", "C2"],
    "evaluation_threshold": 0.02,
    "max_iterations_per_feature": 2
  }'
```

### Get Experiment Results
```bash
curl http://localhost:8000/api/experiments/1
curl http://localhost:8000/api/experiments/1/features
```

---

## Troubleshooting

### Backend won't start
```bash
cd backend
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python -c "from main import app; print('✓ Imports OK')"
```

### Frontend build fails
```bash
cd frontend
rm -rf node_modules package-lock.json .next
npm install
npm run build
```

### Database connection error
```bash
# Test Neon connection
psql postgresql://neondb_owner:npg_kYT2ox1tfRFH@ep-proud-cake-adyer1to-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require -c "SELECT 1"
```

### API returns 500 error
```bash
cd backend
source venv/bin/activate
python -c "from database import init_db, engine; init_db()"
```

---

## Project Structure After Build
```
FeatureLab/
├── backend/
│   ├── main.py
│   ├── agent.py
│   ├── tools.py
│   ├── models.py
│   ├── database.py
│   ├── embedding.py
│   ├── llm.py
│   ├── requirements.txt
│   ├── .env
│   └── venv/
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── dashboard/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── .env.local
│   └── node_modules/
│
├── .vercelrc
├── vercel.json
├── Procfile
├── render.yaml
├── .gitignore
└── README.md
```

---

## Key Files

| File | Purpose |
|------|---------|
| `featurelab-build.prompt` | Full autonomous MVP build |
| `fix-all-versions.prompt` | Version mismatch auditor |
| `image-processor.prompt` | Bulk image analyzer |
| `CLAUDE-CLI-GUIDE.md` | This file |

---

## One-Shot Commands Cheat Sheet

```bash
# Build everything
claude --file featurelab-build.prompt --execute-all --no-confirm

# Fix versions
claude --file fix-all-versions.prompt --execute-all

# Process images
claude code --upload-glob "*.jpeg" --auto-recognize-type

# Start backend
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Start frontend
cd frontend && npm run dev

# Deploy
git push origin main  # Triggers both Vercel & Render

# Test agent
curl -X POST http://localhost:8000/api/agent/run -H "Content-Type: application/json" -d '{...}'
```

---

## Success Criteria

After running `featurelab-build.prompt --execute-all`:

✅ Backend running on http://localhost:8000  
✅ Frontend running on http://localhost:3000  
✅ Landing page loads with animations  
✅ Dashboard accessible at /dashboard  
✅ Database tables created (experiments, features)  
✅ API /health returns 200  
✅ Vercel config ready  
✅ Render config ready  

---

## FAQ

**Q: How long does the build take?**
A: ~10-15 minutes including all installs and builds.

**Q: Can I deploy to Heroku instead of Render?**
A: Yes, create Procfile and use `heroku create`, push to GitHub.

**Q: What if I want to change evaluation_threshold?**
A: Edit `dashboard/page.tsx` line where AgentRunRequest is created, or make it a form input.

**Q: How do I upload real data?**
A: On dashboard, click "Upload CSV", select your file, enter target column name.

**Q: Can I run the agent headless (no UI)?**
A: Yes, just POST to /api/agent/run directly.

---

**Built with 💜 by FeatureLab | Powered by Gemini, Pinecone, Neon**
