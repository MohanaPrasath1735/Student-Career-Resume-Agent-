# 🎓 Student Career & Resume Agent

An AI-powered web application built with **Node.js, Express, OpenRouter API, HTML, internal CSS, and Vanilla JavaScript** to guide students through career matching, target job fit evaluation, Job Description (JD) ATS matching, and truthful resume optimization.

![Student Career & Resume Agent](https://img.shields.io/badge/AI-OpenRouter-indigo) ![Vercel Ready](https://img.shields.io/badge/Deployment-Vercel-black) ![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🌟 Key Features

1. **Profile Upload & AI Parser (`/api/extract-profile`)**
   - Upload PDF, DOCX, or TXT resume files or paste profile text.
   - Includes a **"⚡ Load Demo Profile"** button for instant end-to-end testing.
   - Extracts structured JSON: technical skills, soft skills, tools, education, projects, certifications, strengths, and weaknesses.

2. **Top 5 Career Fit (`/api/career-fit`)**
   - Recommends the student's **top 5 best-fit job roles** with match percentages.
   - Highlights matching skills, missing skills, and step-by-step learning roadmaps.

3. **Job Role Checker (`/api/job-role-checker`)**
   - Evaluates compatibility for any custom role entered by the student (e.g. `Data Analyst`, `Frontend Developer`).
   - Rates candidate as **Strong Fit**, **Moderate Fit**, **Needs Improvement**, or **Poor Fit** with actionable recommendations.

4. **JD Analyzer (`/api/jd-analyzer`)**
   - Compares profile against pasted Job Descriptions.
   - Reports match %, matching skills, missing skills, missing ATS keywords, experience gaps, and tailored resume edits.

5. **Resume Optimizer (`/api/resume-improvement`)**
   - Action-oriented enhancements for Headlines, Summaries, and Project bullet points (XYZ framework).
   - **Strict Authenticity Guarantee**: Never invents false skills, certifications, or fake experience.

---

## 📁 Project Structure

```
├── .env                  # OpenRouter API Key & Port (Git-ignored)
├── .env.example          # Template environment variables
├── .gitignore            # Git exclusion rules
├── package.json          # Dependencies & scripts
├── vercel.json           # Vercel deployment configuration
├── server.js             # Express API backend & OpenRouter AI integration
├── public/
│   └── index.html        # Single Page Application (HTML, CSS & Vanilla JS)
└── README.md             # Documentation
```

---

## 🚀 Local Quickstart

### 1. Prerequisites
- Node.js (v18 or later)
- npm

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory (or use `.env.example`):
```env
PORT=3000
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=google/gemini-2.5-flash
```

### 4. Run Locally
Start the server:
```bash
npm start
```
Visit **`http://localhost:3000`** in your browser.

Click the **"⚡ Load Demo Profile"** button in the top header to populate the sample student resume ("Alex Morgan - Computer Science & Data Analytics Student") and test all 5 AI features instantly!

---

## ☁️ Deployment to GitHub & Vercel

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit of Student Career & Resume Agent"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/student-career-agent.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New Project** and import your `student-career-agent` GitHub repository.
3. Under **Environment Variables**, add:
   - `OPENROUTER_API_KEY`: `your_openrouter_api_key`
4. Click **Deploy**. Vercel will automatically build the serverless functions via `vercel.json` and host your frontend web app!

---

## 🔒 Security
The `OPENROUTER_API_KEY` is securely stored in `.env` and processed exclusively on the backend (`server.js`). It is never exposed to client-side code.
