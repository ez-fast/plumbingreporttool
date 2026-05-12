import express from 'express';
import cors from 'cors';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import multer from 'multer';

dotenv.config();

const app = express();

const upload = multer({
  storage: multer.memoryStorage()
});

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const resend = new Resend(process.env.RESEND_API_KEY);

function calculateRisk(yearBuilt, waterHeater) {

  const currentYear = new Date().getFullYear();
  const age = currentYear - yearBuilt;

  let risk = 'Low';

  if (age > 40) {
    risk = 'High';
  } else if (age > 20) {
    risk = 'Moderate';
  }

  if (waterHeater === 'yes' && age > 15) {
    risk = 'High';
  }

  return risk;
}

app.post(
  '/generate-report',
  upload.single('photo'),
  async (req, res) => {

    try {

      const {
        address,
        email,
        bathrooms,
        waterHeater,
        zip,
        notes,
        reportType
      } = req.body;

      const photo = req.file;

      const propertyResponse = await axios.get(
        `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}`,
        {
          headers: {
            'X-Api-Key': process.env.RENTCAST_API_KEY
          }
        }
      );

      const property = propertyResponse.data[0];

      const yearBuilt = property?.yearBuilt || 1990;

      const risk = calculateRisk(
        yearBuilt,
        waterHeater
      );

      const lowerNotes = (notes || '').toLowerCase();

      // -----------------------------
      // Urgency Detection
      // -----------------------------

      let urgency = 'Low';

      if (
        lowerNotes.includes('leak') ||
        lowerNotes.includes('burst') ||
        lowerNotes.includes('flood') ||
        lowerNotes.includes('sewer smell')
      ) {
        urgency = 'High';
      }
      else if (
        lowerNotes.includes('low pressure') ||
        lowerNotes.includes('slow drain') ||
        lowerNotes.includes('noise')
      ) {
        urgency = 'Moderate';
      }

      // -----------------------------
      // Service Recommendations
      // -----------------------------

      let recommendedServices = [];

      if (lowerNotes.includes('water heater')) {
        recommendedServices.push(
          'Water Heater Inspection'
        );
      }

      if (lowerNotes.includes('drain')) {
        recommendedServices.push(
          'Drain Cleaning Evaluation'
        );
      }

      if (lowerNotes.includes('pressure')) {
        recommendedServices.push(
          'Water Pressure Diagnostic'
        );
      }

      if (lowerNotes.includes('leak')) {
        recommendedServices.push(
          'Leak Detection Inspection'
        );
      }

      // -----------------------------
      // Concerns
      // -----------------------------

      let concerns = [];

      if (yearBuilt >= 1978 && yearBuilt <= 1995) {
        concerns.push(
          'Potential polybutylene piping'
        );
      }

      if (yearBuilt < 1990) {
        concerns.push(
          'Possible aging shutoff valves'
        );
      }

      if (waterHeater === 'yes') {
        concerns.push(
          'Water heater may be approaching end-of-life'
        );
      }

      // -----------------------------
      // Location Risk Factors
      // -----------------------------

      let locationRisks = [];

      if (zip) {

        if (
          zip.startsWith('201') ||
          zip.startsWith('220') ||
          zip.startsWith('221')
        ) {
          locationRisks.push(
            'Northern Virginia high-growth residential zone with mixed plumbing systems across multiple construction eras.'
          );
        }

      }

      // -----------------------------
      // Infrastructure Risks
      // -----------------------------

      let infrastructureRisks = [];

      if (yearBuilt < 1980) {
        infrastructureRisks.push(
          'High probability of galvanized steel piping in original plumbing systems.'
        );
      }

      if (yearBuilt >= 1980 && yearBuilt <= 1995) {
        infrastructureRisks.push(
          'Potential polybutylene piping risk window in regional construction.'
        );
      }

      if (yearBuilt >= 1995 && yearBuilt <= 2010) {
        infrastructureRisks.push(
          'Builder-grade plumbing systems approaching major maintenance lifecycle.'
        );
      }

      // -----------------------------
      // Northern Virginia Insights
      // -----------------------------

      let novaRisks = [];

      if (yearBuilt >= 1978 && yearBuilt <= 1995) {
        novaRisks.push(
          'Northern Virginia homes built during this period may contain polybutylene piping.'
        );
      }

      if (yearBuilt < 1985) {
        novaRisks.push(
          'Older Northern Virginia homes may have aging copper shutoff valves and higher leak risk.'
        );
      }

      if (yearBuilt >= 1990 && yearBuilt <= 2010) {
        novaRisks.push(
          'Homes in this era may have builder-grade water heaters nearing replacement age.'
        );
      }

      // -----------------------------
      // Water Heater Insights
      // -----------------------------

      let waterHeaterEstimate = '';

      if (waterHeater === 'yes') {

        if (yearBuilt < 2010) {
          waterHeaterEstimate =
            'The home may contain an older water heater approaching the end of its expected service life.';
        } else {
          waterHeaterEstimate =
            'The water heater may still be within a normal service window depending on maintenance history.';
        }

      }

      let waterHeaterInsight = '';

      if (waterHeater === 'yes') {

        const age =
          new Date().getFullYear() - yearBuilt;

        if (age > 15) {
          waterHeaterInsight =
            'Water heater likely approaching or beyond typical 10–15 year service life.';
        } else {
          waterHeaterInsight =
            'Water heater likely within normal service range but should be inspected for sediment buildup.';
        }

      }

      // -----------------------------
      // Real Estate Context
      // -----------------------------

      let realEstateInsights = '';

      if (reportType === 'buyer') {
        realEstateInsights =
          'Focus on potential hidden plumbing risks a buyer should investigate before purchase.';
      }

      if (reportType === 'seller') {
        realEstateInsights =
          'Focus on maintenance items that may help avoid inspection objections during sale.';
      }

      if (reportType === 'investor') {
        realEstateInsights =
          'Focus on long-term plumbing reliability and future capital expenditure risks.';
      }

      // -----------------------------
      // Photo Analysis
      // -----------------------------

      let visionAnalysis = '';

      if (photo) {

        const base64Image =
          photo.buffer.toString('base64');

        const visionResponse =
          await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text:
                      'Analyze this plumbing-related image. Describe visible plumbing concerns, corrosion, leaks, aging materials, water damage, or maintenance issues.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url:
                        `data:${photo.mimetype};base64,${base64Image}`
                    }
                  }
                ]
              }
            ]
          });

        visionAnalysis =
          visionResponse
            .choices[0]
            .message
            .content;
      }

      // -----------------------------
      // AI Prompt
      // -----------------------------

      const prompt = `
You are an expert plumber in Northern Virginia.

Write a homeowner-friendly plumbing health report.

Home Information:
- Year Built: ${yearBuilt}
- Bathrooms: ${bathrooms}
- Overall Risk: ${risk}
- Urgency Level: ${urgency}

Homeowner Reported Concerns:
${notes || 'None provided'}

Potential Concerns:
${concerns.join(', ')}

Northern Virginia Risk Factors:
${novaRisks.join(', ')}

Location-Based Risk Factors:
${locationRisks.join(', ')}

Infrastructure Risk Factors:
${infrastructureRisks.join(', ')}

Water Heater Assessment:
${waterHeaterEstimate}

Water Heater Analysis:
${waterHeaterInsight}

Photo Analysis:
${visionAnalysis || 'No photo uploaded'}

Real Estate Context:
${realEstateInsights}

Requirements:
- Sound trustworthy
- Be educational
- Avoid technical jargon
- Recommend preventative maintenance
- Mention when inspection is recommended
- Be concise and practical
- Prioritize location-specific insights
- Focus on homeowner risk awareness
- Avoid fear tactics
- Avoid generic advice
- Do NOT exaggerate risks
- Use clear homeowner language
- Do not diagnose with certainty

IMPORTANT:
- Do NOT include company names
- Do NOT include signatures
- Do NOT include contact information
- Output ONLY technical analysis paragraphs
`;

      const completion =
        await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

      const aiSummary =
        completion.choices[0].message.content;

      // -----------------------------
      // HTML Report
      // -----------------------------

      const html = `
        <h2>Home Plumbing Health Report</h2>

        <p>
          <strong>Estimated Year Built:</strong>
          ${yearBuilt}
        </p>

        <p>
          <strong>Overall Plumbing Risk:</strong>
          ${risk}
        </p>

        <p>
          <strong>Urgency Level:</strong>
          <span style="
            color:
              ${urgency === 'High'
                ? 'red'
                : urgency === 'Moderate'
                ? 'orange'
                : 'green'
              };
            font-weight:bold;
          ">
            ${urgency}
          </span>
        </p>

        <h3>Potential Concerns</h3>

        <ul>
          ${concerns
            .map(c => `<li>${c}</li>`)
            .join('')}
        </ul>

        <h3>Recommended Services</h3>

        <ul>
          ${recommendedServices
            .map(s => `<li>${s}</li>`)
            .join('')}
        </ul>

        <h3>Professional Summary</h3>

        <p>${aiSummary}</p>

        <hr />

        <p>
          <strong>Recommended Next Step:</strong><br />
          Schedule a whole-home plumbing inspection
          to identify potential issues before they
          become expensive repairs.
        </p>

        <hr />

        <div style="
          margin-top:20px;
          font-size:13px;
          color:gray;
        ">
          <strong>EZ-Fast Plumbing</strong><br />
          Northern Virginia Expert Plumbing Services<br />
          Phone: 1-844-4EZFAST<br />
          Email: help@ez-fast.com
        </div>

        <p style="
          font-size:12px;
          color:gray;
        ">
          This report is an automated estimate
          based on public property data and
          homeowner-provided information.
          It is not a plumbing inspection.
        </p>
      `;

      // -----------------------------
      // Send Email
      // -----------------------------

      try {

        const emailResult =
          await resend.emails.send({
            from:
              'EZ Fast Plumbing <help@ez-fast.com>',
            to: email,
            subject:
              'Your Home Plumbing Health Report',
            html: `
              <h1>Your Plumbing Health Report</h1>
              ${html}
            `
          });

        console.log(
          'EMAIL RESULT:',
          emailResult
        );

      } catch (emailError) {

        console.error(
          'EMAIL ERROR:',
          emailError
        );

      }

      res.json({ report: html });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: 'Failed to generate report'
      });

    }

  }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});