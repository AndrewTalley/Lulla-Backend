import { Hono } from "hono";
import { OpenAI } from "openai";
import { z } from "zod";

const schedule = new Hono();

// Validate OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validation schema for schedule creation
const scheduleSchema = z.object({
  ageMonths: z.number().min(0).max(60, "Age must be between 0 and 60 months"),
  wakeTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM"),
  bedtimeWindow: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM"),
  napResistance: z.boolean(),
});

schedule.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = scheduleSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ 
        error: "Validation failed", 
        details: parsed.error.issues 
      }, 400);
    }

    const { ageMonths, wakeTime, bedtimeWindow, napResistance } = parsed.data;

    const prompt = `
You are a baby sleep coach creating a realistic, soothing daily sleep schedule for a child who is ${ageMonths} months old.

Wake Time: ${wakeTime}  
Bedtime Window: ${bedtimeWindow}  
Nap Resistance: ${napResistance ? "Yes" : "No"}

---

## 💤 Markdown Formatting Requirements:

1. Title the schedule: \`## 💤 ${ageMonths}-Month-Old Sleep Schedule\`
2. Use emojis and clear headings: \`### ⏰ Wake-Up — 04:00 AM\`
3. Format times in **bold** (e.g. \`**06:30 AM – 08:00 AM**\`)
4. Include:
   - Naps with headings that start with: \`### 💤 Nap:\`
     - Include start/end time and short description
   - Wake windows with tips or suggested activities
   - A short bedtime routine section
5. End with 2–3 tips under a section titled: \`### 💡 Tips\`
6. Use bullet points where appropriate

Keep tone warm and encouraging. Do **not** repeat the inputs or explain the schedule — just output the markdown.
`;

    const chat = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const scheduleContent = chat.choices[0]?.message.content;
    
    if (!scheduleContent) {
      return c.json({ error: "Failed to generate schedule" }, 500);
    }

    return c.json({
      success: true,
      data: {
        schedule: scheduleContent,
        ageMonths,
        wakeTime,
        bedtimeWindow,
        napResistance,
      }
    });
  } catch (error) {
    console.error("Schedule generation error:", error);
    
    if (error instanceof Error && error.message.includes("OpenAI")) {
      return c.json({ error: "AI service temporarily unavailable" }, 503);
    }
    
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default schedule;
