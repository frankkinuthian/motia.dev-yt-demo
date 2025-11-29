# YouTube Video Title Optimizer

An event-driven application built with **Motia** that analyzes YouTube channels and generates AI-improved video titles using OpenAI's GPT models.

## Workflow Overview

The application implements a complete event-driven workflow:

```
1. POST /submit (API Step)
   ├─ Accepts YouTube channel handle and email
   ├─ Creates job with unique ID
   └─ Emits: yt.submit

2. ResolveChannel (Event Step)
   ├─ Subscribes to: yt.submit
   ├─ Converts YouTube handle (@channelname) to channel ID
   ├─ On error: yt.channel.error
   └─ On success: yt.channel.resolved

3. FetchVideos (Event Step)
   ├─ Subscribes to: yt.channel.resolved
   ├─ Fetches latest 5 videos from the channel
   ├─ On error: yt.videos.error
   └─ On success: yt.videos.fetched

4. AI Title Fetch (Event Step)
   ├─ Subscribes to: yt.videos.fetched
   ├─ Generates improved titles using OpenAI API
   ├─ On error: yt.titles.error
   └─ On success: yt.titles.ready

5. Send Email (Event Step)
   ├─ Subscribes to: yt.videos.ready
   ├─ Sends formatted email with improved titles via Resend
   └─ Emits: yt.email.sent
```

## Features

- **Event-Driven Architecture**: Asynchronous processing using Motia's event system
- **State Management**: Tracks job progress across multiple steps
- **YouTube Integration**: Fetches channel data and videos using YouTube Data API
- **AI Enhancement**: Uses OpenAI GPT to generate improved video titles
- **Error Handling**: Graceful error handling with error event emissions

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- YouTube Data API key
- OpenAI API key

### Environment Variables

Create a `.env.local` file:

```env
YOUTUBE_API_KEY=your_youtube_api_key_here
OPEN_AI_API_KEY=your_openai_api_key_here
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the Motia dev server on `http://localhost:3000` with the visual Workbench.

### Testing

Use Postman or curl to test the API:

```bash
POST http://localhost:3000/submit
Content-Type: application/json

{
  "channel": "@chaiaurcode",
  "email": "user@example.com"
}
```

### Generate Types

After modifying step configurations:

```bash
npx motia generate-types
```

## Project Structure

```
steps/
├── 01.submit-api/
│   └── submit.step.ts              # API endpoint - Entry point
├── 02.resolve-channel/
│   └── resolve-channel.step.ts     # Resolves YouTube handle to channel ID
├── 03.fetch-videos/
│   └── fetch-videos.step.ts        # Fetches videos from channel
├── 04.ai-title/
│   └── ai-title-fetch.step.ts      # Generates improved titles with AI
└── 05.send-email/
    └── send-email.step.ts          # Sends results via email using Resend
```

## State Management

Jobs are tracked in state with the following structure:

```typescript
{
  jobId: string;
  channel: string;
  email: string;
  status: "queued" | "resolving channel" | "fetching videos" | "generating titles" | "titles ready" | "failed";
  createdAt: string;
  updatedAt?: string;
  videos?: Video[];
  improvedTitles?: ImprovedTitle[];
  error?: string;
}
```

## Key Concepts

### State API

The application uses Motia's state management to persist data across steps:

```typescript
// Get state
const jobData = await state.get("jobs", jobId);

// Set state
await state.set("jobs", jobId, { ...jobData, status: "updated" });

// Get all jobs
const allJobs = await state.getGroup("jobs");
```

### Event Emissions

Events are emitted to trigger downstream steps:

```typescript
await emit({
  topic: "yt.submit",
  data: { jobId, channel, email }
});
```

## API Reference

### POST /submit

Submits a YouTube channel for processing.

**Request:**
```json
{
  "channel": "@youtubehandle",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-1764360746024-0v7a35erx",
  "message": "Your job has been queued successfully..."
}
```

## Implementation Status

### ✅ Completed
- ✅ API endpoint for channel submission (`POST /submit`)
- ✅ YouTube channel resolution (handle to ID via YouTube Data API)
- ✅ Video fetching from channel (latest 5 videos)
- ✅ AI title generation scaffold (ready for OpenAI integration)
- ✅ Email delivery via Resend
- ✅ State management across all steps
- ✅ Event-driven workflow with proper event chains
- ✅ Error handling with try-catch blocks

### 📋 TODO (Future Enhancements)
- [ ] **Implement OpenAI API integration** in AI Title Fetch step (currently scaffold only)
- [ ] **Add centralized error handler** for all error topics (channel.error, videos.error, titles.error)
- [ ] Add webhook/SSE for real-time progress updates
- [ ] Implement retry logic with exponential backoff
- [ ] Add database persistence for historical data
- [ ] Add request/response schema validation using Zod
- [ ] Create a query endpoint (`GET /job/:jobId`) to check job status
- [ ] Add rate limiting and authentication

## Resources

- [Motia Documentation](https://motia.dev/docs)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [OpenAI API](https://platform.openai.com/docs)

## License

MIT
