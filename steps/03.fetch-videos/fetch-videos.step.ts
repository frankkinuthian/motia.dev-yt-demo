import { EventConfig } from "motia";

// Step - 3
// fetches videos from a channel using youtube data API
export const config: EventConfig = {
  name: "FetchVideos",
  type: "event",
  subscribes: ["yt.channel.resolved"],
  emits: ["yt.videos.fetched", "yt.videos.error"],
  flows: ["yt-workflow"],
};

interface Video {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;
    const channelId = data.channelId;
    const channelName = data.channelName;

    logger.info("resolving youtube channel", { jobId, channelId });

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "YOUR_API_KEY";
    if (!YOUTUBE_API_KEY) {
      throw new Error("Youtube api key not configured");
    }

    const jobData = await state.get("jobs", jobId);

    await state.set("jobs", jobId, {
      ...jobData,
      status: "Fetching videos",
    });

    const searchUrl = `
      https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=5&key=${YOUTUBE_API_KEY}
      `;

    const res = await fetch(searchUrl);
    const youtubeData = await res.json();

    if (!youtubeData.items || youtubeData.items.length === 0) {
      logger.warn("No videos found for channel", { jobId, channelId });

      // emit failure event
      await state.set("jobs", jobId, {
        ...jobData,
        status: "failed",
        error: "No videos found",
      });

      await emit({
        topic: "yt.videos.error",
        data: {
          jobId,
          email,
          error: "No videos found for this channel",
        },
      });
      return;
    }

    const videos: Video[] = youtubeData.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails.default.url,
    }));

    logger.info("Videos fetched successfully", {
      jobId,
      videoCount: videos.length,
    });

    // Update state & emit
    await state.set("jobs", jobId, {
      ...jobData,
      status: "videos fetched",
      videos,
    });

    await emit({
      topic: "yt.videos.fetched",
      data: {
        jobId,
        channelName,
        email,
        videos,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching videos", { error: error.message });

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
      topic: "yt.videos.error",
      data: {
        jobId,
        email,
        error: "Failed to fetch videos. Please try again.",
      },
    });
  }
};
