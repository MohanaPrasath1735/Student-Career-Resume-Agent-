const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to call OpenRouter API safely
async function callOpenRouter(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing in backend environment variables.');
  }

  // Model fallback preference
  const models = [
    process.env.OPENROUTER_MODEL,
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct',
    'openai/gpt-4o-mini'
  ].filter(Boolean);

  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://vercel.com',
          'X-Title': 'Student Career & Resume Agent',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`OpenRouter model ${model} failed (${response.status}):`, errText);
        lastError = new Error(`OpenRouter Error (${response.status}): ${errText}`);
        continue; // Try next model fallback
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response content received from OpenRouter API.');
      }

      // Parse JSON from model output
      try {
        return JSON.parse(content);
      } catch (e) {
        // Fallback JSON extraction in case formatting contains surrounding markdown
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse AI output as JSON.');
      }
    } catch (err) {
      console.warn(`Attempt with model ${model} threw error:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to complete request with OpenRouter API.');
}

// ----------------------------------------------------
// 1. EXTRACT PROFILE ENDPOINT
// ----------------------------------------------------
app.post('/api/extract-profile', upload.single('file'), async (req, res) => {
  try {
    let rawText = '';

    if (req.file) {
      const mime = req.file.mimetype;
      const originalName = req.file.originalname.toLowerCase();

      if (mime === 'application/pdf' || originalName.endsWith('.pdf')) {
        const parsedPdf = await pdfParse(req.file.buffer);
        rawText = parsedPdf.text;
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        originalName.endsWith('.docx')
      ) {
        const parsedDocx = await mammoth.extractRawText({ buffer: req.file.buffer });
        rawText = parsedDocx.value;
      } else {
        // Plain text file or fallback
        rawText = req.file.buffer.toString('utf-8');
      }
    } else if (req.body.text) {
      rawText = req.body.text;
    } else {
      return res.status(400).json({ error: 'Please upload a resume file (PDF/DOCX/TXT) or paste profile text.' });
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: 'Extracted text is empty. Please check the file or input text.' });
    }

    const systemPrompt = `You are an expert AI Resume & Career Parsing Assistant.
Your task is to analyze raw student resume text and convert it into a clean, structured JSON format.
You must return valid JSON strictly conforming to this structure:
{
  "rawText": "string (the raw text)",
  "name": "string",
  "title": "string",
  "contact": {"email": "string", "phone": "string", "location": "string", "linkedin": "string", "github": "string"},
  "summary": "string",
  "education": [{"degree": "string", "institution": "string", "year": "string", "gpa": "string"}],
  "skills": {
    "technical": ["string"],
    "tools": ["string"],
    "soft": ["string"]
  },
  "projects": [{"title": "string", "description": "string", "technologies": ["string"]}],
  "experience": [{"role": "string", "company": "string", "duration": "string", "highlights": ["string"]}],
  "certifications": ["string"],
  "strengths": ["string"],
  "weaknesses": ["string"]
}`;

    const userPrompt = `Parse the following student profile / resume into the requested JSON schema:\n\n${rawText}`;
    const structuredProfile = await callOpenRouter(systemPrompt, userPrompt);
    structuredProfile.rawText = rawText;

    res.json({ success: true, profile: structuredProfile });
  } catch (error) {
    console.error('Error extracting profile:', error);
    res.status(500).json({ error: error.message || 'Failed to extract and parse profile.' });
  }
});

// ----------------------------------------------------
// 2. CAREER FIT ENDPOINT (TOP 5 ROLES)
// ----------------------------------------------------
app.post('/api/career-fit', async (req, res) => {
  try {
    const { profile } = req.body;
    if (!profile) {
      return res.status(400).json({ error: 'Profile data is required.' });
    }

    const systemPrompt = `You are a Senior University Career Advisor & Talent Matcher.
Analyze the student's profile (skills, education, projects, experience, strengths) and identify their **Top 5 Best-Fit Job Roles** in today's job market.

Return strictly valid JSON in this format:
{
  "topRoles": [
    {
      "rank": 1,
      "roleTitle": "string",
      "matchPercentage": 95,
      "summary": "Short 1-2 sentence explanation of why this student is a great fit.",
      "matchingSkills": ["string"],
      "missingSkills": ["string"],
      "learningRoadmap": ["string (actionable courses, projects, or concepts to master)"],
      "careerOutlook": "High Demand / Growing / Niche"
    }
  ]
}
Ensure exactly 5 roles are returned, sorted from highest match percentage to lowest.`;

    const userPrompt = `Here is the student profile:\n\n${JSON.stringify(profile, null, 2)}`;
    const result = await callOpenRouter(systemPrompt, userPrompt);

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error calculating career fit:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze career fit.' });
  }
});

// ----------------------------------------------------
// 3. JOB ROLE FIT CHECKER ENDPOINT
// ----------------------------------------------------
app.post('/api/job-role-checker', async (req, res) => {
  try {
    const { profile, targetRole } = req.body;
    if (!profile || !targetRole) {
      return res.status(400).json({ error: 'Profile and Target Job Role are required.' });
    }

    const systemPrompt = `You are an AI Job Fit Evaluation Specialist.
Evaluate the student candidate's eligibility for the target role: "${targetRole}".

Categorize the candidate into EXACTLY one of these four fit categories:
- "Strong Fit" (Match >= 80%)
- "Moderate Fit" (Match 60% - 79%)
- "Needs Improvement" (Match 40% - 59%)
- "Poor Fit" (Match < 40%)

Return strictly valid JSON in this format:
{
  "targetRole": "${targetRole}",
  "fitCategory": "Strong Fit | Moderate Fit | Needs Improvement | Poor Fit",
  "matchPercentage": number,
  "verdictSummary": "Detailed explanation of why they fell into this category.",
  "keyStrengths": ["string"],
  "criticalGaps": ["string"],
  "actionSteps": ["string (step-by-step guidance on how to bridge the gap)"]
}`;

    const userPrompt = `Target Role: ${targetRole}\n\nCandidate Profile:\n${JSON.stringify(profile, null, 2)}`;
    const result = await callOpenRouter(systemPrompt, userPrompt);

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error checking job role fit:', error);
    res.status(500).json({ error: error.message || 'Failed to check target job role fit.' });
  }
});

// ----------------------------------------------------
// 4. JD ANALYZER ENDPOINT
// ----------------------------------------------------
app.post('/api/jd-analyzer', async (req, res) => {
  try {
    const { profile, jobDescription } = req.body;
    if (!profile || !jobDescription) {
      return res.status(400).json({ error: 'Both candidate profile and Job Description text are required.' });
    }

    const systemPrompt = `You are an ATS (Applicant Tracking System) & Recruitment Specialist.
Compare the student's profile against the provided Job Description (JD).

Return strictly valid JSON in this format:
{
  "detectedJobTitle": "string",
  "matchPercentage": number,
  "matchingSkills": ["string"],
  "missingSkills": ["string"],
  "missingKeywords": ["string (critical ATS keywords found in JD but missing in profile)"],
  "experienceGaps": ["string (gaps in required years, domain exposure, or responsibilities)"],
  "resumeUpdateSuggestions": ["string (specific, actionable advice on what to edit or highlight in the resume)"]
}`;

    const userPrompt = `JOB DESCRIPTION:\n${jobDescription}\n\nSTUDENT PROFILE:\n${JSON.stringify(profile, null, 2)}`;
    const result = await callOpenRouter(systemPrompt, userPrompt);

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error in JD analyzer:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze Job Description.' });
  }
});

// ----------------------------------------------------
// 5. RESUME IMPROVEMENT ENDPOINT
// ----------------------------------------------------
app.post('/api/resume-improvement', async (req, res) => {
  try {
    const { profile, targetRole } = req.body;
    if (!profile) {
      return res.status(400).json({ error: 'Candidate profile is required.' });
    }

    const systemPrompt = `You are a Professional Resume Writer & Career Coach.
Your goal is to optimize the student's resume for maximum impact, ATS readability, and recruiter engagement.

CRITICAL MANDATE:
- NEVER INVENT false skills, false experience, fake certifications, or unverified achievements.
- Rephrase existing projects, coursework, and skills using strong action verbs, quantifiable frameworks, and clear impact.

Return strictly valid JSON in this format:
{
  "truthfulnessGuarantee": "All suggestions strictly refine existing experience without fabrication.",
  "headlineSuggestions": ["3 high-impact headline options"],
  "summaryImprovements": {
    "original": "Current summary or extracted overview",
    "improvedVersion": "Polished, compelling 3-line professional summary"
  },
  "skillsOptimization": {
    "suggestedFormatting": ["Grouped category suggestions"],
    "missingEssentialTechToHighlight": ["Real skills already in text that need higher visibility"]
  },
  "projectBulletEnhancements": [
    {
      "projectTitle": "string",
      "originalBullets": ["string"],
      "actionOrientedBullets": ["string (rewritten using XYZ framework: Accomplished [X] as measured by [Y], by doing [Z])"]
    }
  ],
  "experienceBulletEnhancements": [
    {
      "roleCompany": "string",
      "actionOrientedBullets": ["string"]
    }
  ]
}`;

    const userPrompt = `Target Role Focus (Optional): ${targetRole || 'General Tech / Industry'}\n\nStudent Profile:\n${JSON.stringify(profile, null, 2)}`;
    const result = await callOpenRouter(systemPrompt, userPrompt);

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error improving resume:', error);
    res.status(500).json({ error: error.message || 'Failed to generate resume improvements.' });
  }
});

// Catch-all route to serve index.html for SPA/Vercel
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server Listen (only when executed directly, compatible with Vercel serverless export)
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Student Career & Resume Agent backend running at http://localhost:${PORT}`);
  });
}

module.exports = app;
