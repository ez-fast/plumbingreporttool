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

const { address, email, bathrooms, waterHeater } = req.body;

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

Requirements:
- Sound trustworthy
- Be educational
- Avoid fear tactics
- Avoid technical jargon
- Recommend preventative maintenance
- Mention that an inspection is recommended
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

      <p style="font-size:12px;color:gray;">
        This report is an automated estimate based on public
        property data and homeowner-provided information.
        It is not a plumbing inspection.
      </p>
    `;

await resend.emails.send({
  from: 'reports@yourdomain.com',
  to: email,
  subject: 'Your Home Plumbing Health Report',
  html: `
    <h1>Your Plumbing Health Report</h1>
    ${html}
  `
});

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