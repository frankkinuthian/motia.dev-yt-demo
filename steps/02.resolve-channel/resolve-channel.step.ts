import { EventConfig } from "motia";

// Step - 2
// converts yt handle/name to channel ID using youtube data API
export const config: EventConfig = {
  name: "ResolveChannel",
  type: "event",
  subscribes: ["yt.submit"],
  emits: ["yt.channel.resolved", "yt.channel.error"],
  flows: ["yt-workflow"],
};

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;

    const channel = data.channel;

    logger.info("resolving youtube channel", { jobId, channel });

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "YOUR_API_KEY";

    if (!YOUTUBE_API_KEY) {
      throw new Error("Youtube api key not configured");
    }

    const jobData = await state.get("jobs", jobId);

    await state.set("jobs", jobId, {
      ...jobData,
      status: "resolving channel",
    });

    let channelId: string | null = null;
    let channelName: string = "";

    if (channel.startsWith("@")) {
      const handle = channel.substring(1);

      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
        handle,
      )}&key=${YOUTUBE_API_KEY}`;

      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      if (searchData.items && searchData.items.length > 0) {
        channelId = searchData.items[0].snippet.channelId;
        channelName = searchData.items[0].snippet.title;
      }
    } else {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
        channel,
      )}&key=${YOUTUBE_API_KEY}`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (searchData.items && searchData.items.length > 0) {
        channelId = searchData.items[0].snippet.channelId;
        channelName = searchData.items[0].snippet.title;
      }
    }

    if (!channelId || !channelName) {
      logger.error("Channel not found", { channel });
      await state.set("jobs", jobId, {
        ...jobData,
        status: "failed",
        error: "channel not found",
      });
      await emit({
        topic: "yt.channel.error",
        data: {
          jobId,
          email,
        },
      });
      return;
    }

    await emit({
      topic: "yt.channel.resolved",
      data: {
        jobId,
        channelId,
        channelName,
        email,
      },
    });
    return;
  } catch (error: any) {
    logger.error("Error resolving channel", { error: error.message });

    if (!jobId || !email) {
      logger.error("Cannot send error notification - missing jobId or email");
      return;
    }

    const jobData = await state.get("jobs", jobId);

    await state.set("jobs", jobId, {
      ...jobData,
      status: "failed",
      error: error.message,
    });

    // emit
    await emit({
      topic: "yt.channel.error",
      data: {
        jobId,
        email,
        error: "Failed to resolve channel. Please try again.",
      },
    });
  }
};
