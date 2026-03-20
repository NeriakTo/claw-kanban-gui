import type { VideoCloudStore } from '../store/video-store.js';
import type { VideoClipParams, VideoQueryParams } from '../types.js';

/**
 * Handle the video_clip tool call.
 * Supports full pipeline (process) and individual steps.
 */
export async function handleVideoClip(
  store: VideoCloudStore,
  params: VideoClipParams
): Promise<any> {
  const progress = (msg: string) => console.log(`[video] ${msg}`);

  switch (params.action) {
    case 'process': {
      // Full pipeline: upload → transcribe → analyze → split
      if (!params.filePath) {
        return { success: false, error: 'filePath is required for process action' };
      }

      // 1. Upload
      progress('Step 1/4: Uploading video...');
      const upload = await store.uploadVideo(params.filePath, progress);

      // 2. Transcribe
      progress('Step 2/4: Transcribing audio...');
      const transcription = await store.transcribe(
        upload.storagePath,
        upload.fileName,
        params.keywords,
        progress
      );

      // 3. Analyze
      progress('Step 3/4: AI semantic analysis...');
      const analysis = await store.analyze(
        transcription.segments,
        transcription.duration,
        transcription.projectId,
        progress
      );

      // 4. Split
      progress('Step 4/4: Splitting video into clips...');
      const splitResult = await store.split(
        transcription.videoPath,
        analysis.segments.map((s) => ({
          start: s.start,
          end: s.end,
          title: s.title,
          segmentId: s.segmentId,
        })),
        transcription.projectId,
        progress
      );

      return {
        success: true,
        projectId: transcription.projectId,
        clipCount: splitResult.segments.length,
        clips: splitResult.segments.map((s) => ({
          title: s.title,
          publicUrl: s.publicUrl,
        })),
        message: `Video processed successfully: ${splitResult.segments.length} clips created.`,
      };
    }

    case 'transcribe': {
      if (!params.storagePath || !params.fileName) {
        return { success: false, error: 'storagePath and fileName are required for transcribe action' };
      }
      const result = await store.transcribe(
        params.storagePath,
        params.fileName,
        params.keywords,
        progress
      );
      return { success: true, ...result };
    }

    case 'analyze': {
      if (!params.segments || !params.videoDuration) {
        return { success: false, error: 'segments and videoDuration are required for analyze action' };
      }
      const result = await store.analyze(
        params.segments,
        params.videoDuration,
        params.projectId,
        progress
      );
      return { success: true, ...result };
    }

    case 'split': {
      if (!params.videoPath || !params.videoSegments) {
        return { success: false, error: 'videoPath and videoSegments are required for split action' };
      }
      const result = await store.split(
        params.videoPath,
        params.videoSegments,
        params.projectId,
        progress
      );
      return { success: true, ...result };
    }

    case 'retranscribe': {
      if (!params.projectId) {
        return { success: false, error: 'projectId is required for retranscribe action' };
      }
      const result = await store.retranscribe(
        params.projectId,
        params.keywords,
        progress
      );
      return { success: true, ...result };
    }

    default:
      return { success: false, error: `Unknown action: ${params.action}` };
  }
}

/**
 * Handle the video_query tool call.
 */
export async function handleVideoQuery(
  store: VideoCloudStore,
  params: VideoQueryParams
): Promise<any> {
  switch (params.query) {
    case 'list': {
      const projects = await store.listProjects();
      return {
        success: true,
        projects: projects.map((p) => ({
          id: p.id,
          title: p.title,
          duration: p.duration,
          created_at: p.created_at,
          upload_status: p.upload_status,
        })),
      };
    }

    case 'detail': {
      if (!params.projectId) {
        return { success: false, error: 'projectId is required for detail query' };
      }
      const detail = await store.getProject(params.projectId);
      return {
        success: true,
        project: {
          id: detail.project.id,
          title: detail.project.title,
          duration: detail.project.duration,
          created_at: detail.project.created_at,
        },
        segments: detail.segments.map((s) => ({
          title: s.title,
          summary: s.summary,
          start: s.start,
          end: s.end,
          publicUrl: s.publicUrl,
          downloadUrl: s.downloadUrl,
        })),
      };
    }

    case 'download': {
      if (!params.projectId) {
        return { success: false, error: 'projectId is required for download query' };
      }
      const detail = await store.getProject(params.projectId);
      const outputDir = params.outputDir ?? './clips';
      const segments = detail.segments;

      if (segments.length === 0) {
        return { success: false, error: 'No clips found for this project. Run split first.' };
      }

      // Filter by segment index if specified
      const toDownload = params.segmentIndex !== undefined
        ? segments.filter((_, i) => i === params.segmentIndex)
        : segments;

      if (toDownload.length === 0) {
        return { success: false, error: `Segment index ${params.segmentIndex} not found` };
      }

      const downloaded: string[] = [];
      for (const seg of toDownload) {
        if (!seg.publicUrl) continue;
        const safeTitle = (seg.title || 'clip').replace(/[^a-zA-Z0-9._-]/g, '_');
        const outputPath = `${outputDir}/${safeTitle}.mp4`;
        await store.downloadClip(seg.publicUrl, outputPath);
        downloaded.push(outputPath);
      }

      return {
        success: true,
        downloaded,
        message: `Downloaded ${downloaded.length} clip(s) to ${outputDir}`,
      };
    }

    default:
      return { success: false, error: `Unknown query: ${params.query}` };
  }
}
