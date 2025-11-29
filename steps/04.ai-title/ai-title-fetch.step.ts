import { EventConfig } from "motia";

// Step 4
// Use Open-AI GPT-4/4o to generate better titles
export const config: EventConfig = {
  name: "AI Title Fetch & Generate",
  type: "event",
  subscribes: ["yt.videos.fetched"],
  emits: ["yt.titles.ready", "yt.titles.error"],
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
  let email: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;
    const channelName = data.channelName;

    const videos = data.videos;

    logger.info("resolving youtube channel", {
      jobId,
      videoCount: videos.length,
    });

    const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY || "YOUR_API_KEY";
    if (!OPEN_AI_API_KEY) {
      throw new Error("OpenAI api key not configured");
    }

    const jobData = await state.get("jobs", jobId);

    await state.set("jobs", jobId, {
      ...jobData,
      status: "generating titles",
    });

    // TODO: Call OpenAI API to generate improved titles
    const videoTitles = videos
      .map(
        (v: Video, idx: number) => `
      ${idx + 1}. "${v.title}"
      `,
      )
      .join("\n");

    const prompt = `You are a YouTube title optimization expert. Below are ${videos.length}
      video titles from the channel "${channelName}".


      For each title, provide,
      1. An improved version that is more friendly, SEO engaging, and likely to get more clicks.
      2. A brief rationale (1-2 sentences) explaining why the improved version is better.

      Guidelines:
      - Keep the core topic and authenticity.
      - Use action verbs, numbers, and specific value propositions.
      - Make it curiosity inducing, without being clickbait.
      - Optimize for seachability & clarity.


     Video Titles:
    ${videoTitles}

    Respond in JSON format:
   {
     "titles: [
        {
        "original": "....",
        "improved": "....",
        "rationale": "...."
        }
      ]
   }
      `;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPEN_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a Youtube SEO and engagement expert who helps creators write better video titles",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.9,
        response_format: {
          type: "json_object",
        },
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(
        `OpenAI API error: ${errorData.error?.message} || "Unknown AI error`,
      );
    }

    const aiResponse = await res.json();
    const aiContent = aiResponse.choices[0].message.content;

    const parsedResponse = JSON.parse(aiContent);

    const improvedTitles: ImprovedTitle[] = parsedResponse.titles.map(
      (title: any, idx: number) => ({
        original: title.original,
        improved: title.improved,
        rationale: title.rationale,
        url: videos[idx].url,
      }),
    );
    logger.info(
      `Generated ${improvedTitles.length} improved titles successfully`,
      {
        jobs: jobId,
        count: improvedTitles.length,
      },
    );

    await state.set("jobs", jobId, {
      ...jobData,
      status: "titles ready",
      improvedTitles,
    });

    // emit
    await emit({
      topic: "yt.titles.ready",
      data: {
        jobId,
        channelName,
        improvedTitles,
        email,
      },
    });
  } catch (error: any) {
    logger.error("Error generating titles", { error: error.message });

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
      topic: "yt.titles.error",
      data: {
        jobId,
        email,
        error: "Failed to improve titles for the videos. Please try again.",
      },
    });
  }
};
