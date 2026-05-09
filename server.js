import express from 'express';
import cors from 'cors';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

const app = express();

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

app.post('/generate-report', async (req, res) => {

  try {

const { address, email, bathrooms, waterHeater, zip } = req.body;

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

    const risk = calculateRisk(yearBuilt, waterHeater);

    let concerns = [];
let locationRisks = [];
let infrastructureRisks = [];

if (zip) {

  // Northern Virginia high-growth zones
  if (zip.startsWith("201") || zip.startsWith("220") || zip.startsWith("221")) {
    locationRisks.push(
      "Northern Virginia high-growth residential zone with mixed plumbing systems across multiple construction eras."
    );
  }

  // Older suburban infrastructure
  if (zip.startsWith("221") || zip.startsWith("220")) {
    infrastructureRisks.push(
      "Older Fairfax / Arlington-era infrastructure may include aging copper or galvanized piping in legacy homes."
    );
  }

}

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

if (yearBuilt < 1980) {
  infrastructureRisks.push("High probability of galvanized steel piping in original plumbing systems.");
}

if (yearBuilt >= 1980 && yearBuilt <= 1995) {
  infrastructureRisks.push("Potential polybutylene piping risk window in regional construction.");
}

if (yearBuilt >= 1995 && yearBuilt <= 2010) {
  infrastructureRisks.push("Builder-grade plumbing systems approaching major maintenance lifecycle.");
}

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

let waterHeaterInsight = "";

if (waterHeater === 'yes') {

  const age = new Date().getFullYear() - yearBuilt;

  if (age > 15) {
    waterHeaterInsight = "Water heater likely approaching or beyond typical 10–15 year service life.";
  } else {
    waterHeaterInsight = "Water heater likely within normal service range but should be inspected for sediment buildup.";
  }

}

    if (yearBuilt >= 1978 && yearBuilt <= 1995) {
      concerns.push('Potential polybutylene piping');
    }

    if (yearBuilt < 1990) {
      concerns.push('Possible aging shutoff valves');
    }

    if (waterHeater === 'yes') {
      concerns.push('Water heater may be approaching end-of-life');
    }

    const prompt = `
You are an expert plumber in Northern Virginia.

Write a homeowner-friendly plumbing health report.

Home Information:
- Year Built: ${yearBuilt}
- Bathrooms: ${bathrooms}
- Overall Risk: ${risk}

Potential Concerns:
${concerns.join(', ')}

Northern Virginia Risk Factors:
${novaRisks.join(', ')}

Location-Based Risk Factors:
${locationRisks.join(", ")}

Infrastructure Risk Factors:
${infrastructureRisks.join(", ")}

Water Heater Assessment:
${waterHeaterEstimate}

Water Heater Analysis:
${waterHeaterInsight}

Requirements:
- Sound trustworthy
- Be educational
- Avoid technical jargon
- Recommend preventative maintenance
- Mention that an inspection is recommended
- Be concise and highly practical
- Prioritize location-specific insights
- Focus on homeowner risk awareness
- Avoid generic advice
- Avoid fear tactics
- Do NOT exaggerate risks
- Use clear, non-technical language
- Always recommend inspection if moderate/high risk

IMPORTANT:
- Do NOT include company names
- Do NOT include signatures
- Do NOT include contact information
- Do NOT include closing statements like "thank you"
- Output ONLY technical analysis paragraphs
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const aiSummary = completion.choices[0].message.content;

    const html = `
      <h2>Home Plumbing Health Report</h2>

      <p><strong>Estimated Year Built:</strong> ${yearBuilt}</p>

      <p><strong>Overall Plumbing Risk:</strong> ${risk}</p>

      <h3>Potential Concerns</h3>

      <ul>
        ${concerns.map(c => `<li>${c}</li>`).join('')}
      </ul>

      <h3>Professional Summary</h3>

      <p>${aiSummary}</p>

      <hr />

      <p>
        <strong>Recommended Next Step:</strong><br />
        Schedule a whole-home plumbing inspection to identify
        potential issues before they become expensive repairs.
      </p>

<hr />

<div style="margin-top:20px;font-size:13px;color:gray;">
  <strong>EZ-Fast Plumbing</strong><br />
  Northern Virginia Expert Plumbing Services<br />
  Phone: 1844-4EZFAST<br />
  Email: Help@EZ-FAST.com
</div>

      <p style="font-size:12px;color:gray;">
        This report is an automated estimate based on public
        property data and homeowner-provided information.
        It is not a plumbing inspection.
      </p>
    `;

 try {

  const emailResult = await resend.emails.send({
    from: 'EZ Fast Plumbing <help@ez-fast.com>',
    to: email,
    subject: 'Your Home Plumbing Health Report',
    html: `
      <h1>Your Plumbing Health Report</h1>
      ${html}
    `
  });

  console.log("EMAIL RESULT:", emailResult);

} catch (emailError) {

  console.error("EMAIL ERROR:", emailError);

}

res.json({ report: html });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Failed to generate report'
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});