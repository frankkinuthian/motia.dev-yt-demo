import { EventConfig, Handlers } from "motia";
import { z } from "zod";

// Step 6 - Centralized Error Handler
// Catches all errors from the workflow pipeline and handles them uniformly
const inputSchema = z.object({
  jobId: z.string(),
  email: z.string().email(),
  error: z.string(),
});

export const config: EventConfig = {
  name: "Centralized Error Handler",
  type: "event",
  description: "Handles all errors from the yt-workflow pipeline",
  subscribes: [
    "yt.channel.error", // From Step 2 (ResolveChannel)
    "yt.videos.error", // From Step 3 (FetchVideos)
    "yt.titles.error", // From Step 4 (AI Title)
    "yt.email.error", // From Step 5 (SendEmail)
  ],
  emits: ["yt.error.handled"],
  input: inputSchema,
  flows: ["yt-workflow"],
};

export const handler = async (input: any, { logger, state }: any) => {
  const { jobId, email, error } = input;

  logger.info("Error caught in workflow", { jobId, email, error });

  try {
    // Get current job data
    const jobData = await state.get("jobs", jobId);

    // Mark job as failed with error details
    const failedJob = {
      ...jobData,
      status: "failed",
      error,
      failedAt: new Date().toISOString(),
    };

    await state.set("jobs", jobId, failedJob);

    logger.info("Job marked as failed", {
      jobId,
      error,
      failedAt: failedJob.failedAt,
    });

    // TODO: Send error notification email to user
    // await emailService.send({
    //   to: email,
    //   subject: `YouTube Title Optimizer - Error Processing Your Request`,
    //   template: "error-notification",
    //   data: {
    //     jobId,
    //     error,
    //     supportEmail: "support@yourdomain.com"
    //   }
    // });

    logger.info("Error handled successfully", { jobId });
  } catch (err: any) {
    logger.error("Failed to handle error", {
      jobId,
      originalError: error,
      handlingError: err.message,
    });
    throw err;
  }
};
