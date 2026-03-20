---
name: video-clip
description: Process videos into short clips — upload, transcribe, AI-analyze, and split. Manage video projects and download clips.
user-invocable: true
metadata: { "clawdbot": { "emoji": "🎬" } }
---

## Video Clip Processing

You can help the user process videos into short, topic-based clips using the `video_clip` and `video_query` tools. This is a multi-step pipeline: upload → transcribe → AI analysis → split.

### Quick Start — Full Pipeline

For the simplest workflow, use the `process` action which runs the entire pipeline in one call:

```
video_clip(action="process", filePath="/path/to/video.mp4")
```

Optional: add `keywords` to improve transcription accuracy for domain-specific terminology:
```
video_clip(action="process", filePath="/path/to/video.mp4", keywords="React, TypeScript, Next.js")
```

### Individual Steps

If the user wants more control, run each step separately:

1. **Transcribe** — Extract and transcribe audio from an already-uploaded video:
   ```
   video_clip(action="transcribe", storagePath="originals/uuid/file.mp4", fileName="file.mp4", keywords="...")
   ```
   Returns: `{ segments, videoPath, duration, projectId }`

2. **Analyze** — AI semantic analysis to identify clip boundaries:
   ```
   video_clip(action="analyze", segments=[...], videoDuration=120, projectId="...")
   ```
   Returns: `{ segments }` with titles, summaries, and time ranges

3. **Split** — Cut the video into clips and upload to cloud:
   ```
   video_clip(action="split", videoPath="https://...", videoSegments=[{start, end, title, segmentId}], projectId="...")
   ```
   Returns: `{ segments }` with public URLs

4. **Re-transcribe** — Re-do transcription for an existing project (e.g., with better keywords):
   ```
   video_clip(action="retranscribe", projectId="...", keywords="new keywords")
   ```

### Managing Projects

Use `video_query` to manage existing video projects:

- **List all projects**:
  ```
  video_query(query="list")
  ```

- **Get project detail** (includes all clips with URLs):
  ```
  video_query(query="detail", projectId="...")
  ```

- **Download clips** to local disk:
  ```
  video_query(query="download", projectId="...", outputDir="./my-clips")
  ```
  Download a specific segment:
  ```
  video_query(query="download", projectId="...", segmentIndex=0)
  ```

### Tips

- The `process` action is the recommended starting point for most users
- Keywords help with industry jargon, proper nouns, and technical terms
- Each project stores the original video, transcript, and all generated clips in the cloud
- Clips can be previewed via their `publicUrl` or downloaded locally
- Projects can be deleted from the web dashboard at www.teammate.work
