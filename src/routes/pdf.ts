import { Hono } from "hono";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { users } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import type { Variables } from "../types";

const app = new Hono<{ Variables: Variables }>();

app.use(authMiddleware);

function stripUnsupported(text: string) {
  return text.replace(/[^\x00-\x7F]/g, "");
}

app.post("/", async (c) => {
  const user = c.get("user");

  const body = await c.req.json();
  const schema = z.object({
    planId: z.string().optional(),
    schedule: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid request" }, 400);

  let markdown: string | null = null;
  let plan: any = null;

  if (parsed.data.planId) {
    plan = await db.query.plans.findFirst({
      where: (p, { eq, and }) =>
        and(eq(p.id, parsed.data.planId!), eq(p.userId, user.id)),
    });
    if (!plan) return c.json({ error: "Plan not found" }, 404);
    markdown = plan.markdown;
  } else if (parsed.data.schedule) {
    markdown = parsed.data.schedule;
  } else {
    return c.json({ error: "No plan or schedule provided" }, 400);
  }

  // Check if user has basic access or higher
  if (user.subscriptionTier === 'free') {
    return c.json(
      { error: "You need a subscription to export PDFs" },
      403
    );
  }

  // Check export credits for basic users
  if (user.subscriptionTier === 'basic' && user.exportCredits <= 0) {
    return c.json(
      { error: "You've used all your export credits for this month" },
      403
    );
  }

  // Deduct credits for basic users
  if (user.subscriptionTier === 'basic') {
    await db
      .update(users)
      .set({ exportCredits: sql`${users.exportCredits} - 1` })
      .where(eq(users.id, user.id));
  }

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const lineHeight = fontSize + 4;

  const pastelPink = rgb(1.0, 0.8, 0.9);
  let title = "Sleep Schedule";

  // Dynamically read baby age from plan
  if (parsed.data.planId && plan) {
    const babyAge = plan.babyAgeMonths;
    if (babyAge && babyAge > 0) {
      title = `${babyAge}-Month-Old Sleep Schedule`;
    }
  }

  let y = height - 60;

  page.drawText(title, {
    x: 50,
    y,
    size: 20,
    font,
    color: pastelPink,
  });
  y -= 40;

  if (!markdown) {
    return c.json({ error: "No content to generate PDF from" }, 400);
  }
  
  const lines = markdown.split("\n");
  let currentHeading = "";
  let currentTime = "";
  let bullets: string[] = [];

  const drawDivider = () => {
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: pastelPink,
    });
    y -= 16;
  };

  const drawSection = () => {
    if (!currentHeading) return;

    const ensureSpace = (needed: number) => {
      if (y < needed) {
        page = pdfDoc.addPage();
        y = height - 60;
      }
    };

    ensureSpace(80);

    page.drawText(currentHeading, {
      x: 50,
      y,
      size: 16,
      font,
      color: pastelPink,
    });
    y -= 22;

    if (currentTime) {
      page.drawText(currentTime, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0.6, 0.4, 0.5),
      });
      y -= 18;
    }

    for (const b of bullets) {
      const wrapped = b.match(/.{1,90}/g) || [b];
      wrapped.forEach((line, idx) => {
        ensureSpace(30);
        page.drawText((idx === 0 ? "• " : "   ") + line.trim(), {
          x: 60,
          y,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= lineHeight;
      });
      y -= 6;
    }

    drawDivider();

    currentHeading = "";
    currentTime = "";
    bullets = [];
  };

  for (let line of lines) {
    let clean = stripUnsupported(line.trim());

    if (clean.startsWith("```")) continue;
    
    // Skip lines that contain the main title (regardless of markdown formatting)
    const cleanTitle = title.replace(/[^\w\s-]/g, "").toLowerCase();
    const cleanLine = clean.replace(/[^\w\s-]/g, "").toLowerCase();
    if (cleanLine.includes(cleanTitle)) continue;

    if (clean.startsWith("###") || clean.startsWith("##")) {
      drawSection();
      currentHeading = clean.replace(/^#+\s*/, "");
    } else if (clean.startsWith("**") && clean.endsWith("**")) {
      currentTime = clean.replace(/\*\*/g, "").trim();
    } else if (clean.startsWith("- ")) {
      const bullet = clean
        .replace("- ", "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .trim();
      bullets.push(bullet);
    } else if (clean !== "") {
      const text = clean.replace(/\*\*(.*?)\*\*/g, "$1").trim();
      if (bullets.length > 0) {
        bullets[bullets.length - 1] += " " + text;
      } else {
        bullets.push(text);
      }
    }
  }

  drawSection();

  // Add page numbers
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const pg = pdfDoc.getPage(i);
    pg.drawText(`${i + 1}`, {
      x: width - 40,
      y: 20,
      size: 10,
      font,
      color: pastelPink,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="sleep-schedule.pdf"',
    },
  });
});

export default app;
