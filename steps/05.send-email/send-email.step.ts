import { EventConfig } from "motia";

// Step 5
// Send email using Resend, formatted with improved titles
export const config: EventConfig = {
  name: "Send Email with Improved Titles",
  type: "event",
  subscribes: ["yt.titles.ready"],
  emits: ["yt.email.sent"],
  flows: ["yt-workflow"],
};

interface Video {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
}

interface ImprovedTitle {
  original: string;
  improved: string;
  rational: string;
  url: string;
}

export const handler = async (eventData: any, { emit, state, logger }: any) => {
  let jobId: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    const email = data.email;
    const channelName = data.channelName;
    const improvedTitles = data.improvedTitles;

    logger.info("Sending email", {
      jobId,
      email,
      titleCount: improvedTitles.length,
    });

    const RESEND_FROM_EMAIL =
      process.env.RRESEND_FROM_EMAIL || "YOUR_EMAIL_ADDRESS";
    const RESEND_API_KEY = process.env.RESEND_API_KEY || "YOUR_API_KEY";
    if (!RESEND_API_KEY) {
      throw new Error("Resend api key not configured");
    }

    const jobData = await state.get("jobs", jobId);

    await state.set("jobs", jobId, {
      ...jobData,
      status: "sending email",
    });

    const emailText = generateEmailText(channelName, improvedTitles);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: `New Titles for ${channelName}`,
        text: emailText,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(
        `Resend API error: ${errorData.error?.message} || "Unknown Email error`,
      );
    }

    const emailResult = await res.json();

    logger.info("Email sent successfully", {
      jobId,
      emailId: emailResult.id,
    });

    await state.set("jobs", jobId, {
      ...jobData,
      status: "email sent, workflow completed",
      emailId: emailResult.id,
      completedAt: new Date().toISOString(),
    });

    // emit
    await emit({
      topic: "yt.email.sent",
      data: {
        jobId,
        email,
        emailId: emailResult.id,
      },
    });
  } catch (error: any) {
    logger.error("Error sending email", { error: error.message });

    if (!jobId) {
      logger.error("Cannot send error notification - missing jobId");
      return;
    }

    const jobData = await state.get("jobs", jobId);

    await state.set("jobs", jobId, {
      ...jobData,
      status: "failed",
      error: error.message,
    });

    // TODO if you want to chain extra steps: emit here
  }
};

function generateEmailText(
  channelName: string,
  titles: ImprovedTitle[],
): string {
  let text = `
    YouTube tiltle doctor - Improved Titles for ${channelName}\n
    `;
  text += `${"=".repeat(60)}\n\n`;

  titles.forEach((title, idx) => {
    text += `Video ${idx + 1}:\n`;
    text += `---------\n`;
    text += `Original title: ${title.original}\n`;
    text += `Improved title: ${title.improved}\n`;
    text += `Why: ${title.rational}\n`;
    text += `Watch: ${title.url}\n\n`;
  });

  text += `${"=".repeat(60)}\n\n`;

  text += `Thank you for using YouTube Title Doctor!\n`;
  text += `Powered by Motia.dev`;

  return text;
}
