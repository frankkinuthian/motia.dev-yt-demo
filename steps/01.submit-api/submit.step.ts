import { ApiRouteConfig } from "motia";

// Step 1 :
// Accepting channel name & email to start the wf
export const config: ApiRouteConfig = {
  name: "Submitchannel",
  type: "api",
  path: "/submit",
  method: "POST",
  emits: ["yt.submit"],
  flows: ["yt-workflow"],
};

interface SubmitRequest {
  channel: string;
  email: string;
}

export const handler = async (req: any, { emit, logger, state }: any) => {
  try {
    logger.info("Received submission request", {
      body: req.body,
    });

    const { channel, email } = req.body as SubmitRequest;

    if (!channel || !email) {
      return {
        status: 400,
        body: {
          error: "Missing required fields: channel & email",
        },
      };
    }

    // validate
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        body: {
          error: "Invalid email format",
        },
      };
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await state.set("jobs", jobId, {
      jobId,
      channel,
      email,
      status: "queued",
      createdAt: new Date().toISOString(),
    });

    logger.info("Job submitted successfully", {
      jobId,
      channel,
      email,
    });

    // emit
    try {
      await emit({
        topic: "yt.submit",
        data: { jobId, channel, email },
      });
    } catch (error: any) {
      logger.warn("Event emission failed (non-blocking)", {
        error: error.message,
      });
      // Continue anyway - the API response is still sent
    }

    return {
      status: 202,
      body: {
        success: true,
        jobId,
        message:
          "Your job has been queued successfully. You should receive an email soon with improved suggestions for your videos.",
      },
    };
  } catch (error: any) {
    logger.error("Error in submission handler", {
      error: error?.message || JSON.stringify(error) || "Unknown error",
      stack: error?.stack,
      errorType: typeof error,
    });
    return {
      status: 500,
      body: {
        error: error.message,
        stack: error.stack, // Add the stack trace
        name: error.name,
      },
    };
  }
};
