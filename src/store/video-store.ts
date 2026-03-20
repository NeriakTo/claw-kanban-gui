import { readNdjsonResponse } from './ndjson-reader.js';
import type {
  TranscriptSegment,
  VideoSegment,
  VideoProject,
  VideoProjectDetail,
} from '../types.js';

/**
 * Cloud store for video clip operations.
 * Talks to the cloud-kanban video API routes using API key auth.
 */
export class VideoCloudStore {
  private apiKey: string;
  private baseEndpoint: string; // e.g. "https://teammate.work"

  constructor(apiKey: string, endpoint: string) {
    this.apiKey = apiKey;
    // Strip trailing /api/v1 to get the base URL — video routes are at /api/video/*
    this.baseEndpoint = endpoint.replace(/\/api\/v1\/?$/, '');
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  /**
   * Upload a video file to cloud storage via the CLI upload endpoint.
   */
  async uploadVideo(
    filePath: string,
    onProgress?: (message: string) => void
  ): Promise<{ storagePath: string; fileName: string }> {
    const { existsSync, readFileSync } = await import('fs');
    const { basename } = await import('path');

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = basename(filePath);
    if (onProgress) onProgress(`Uploading ${fileName}...`);

    const fileBuffer = readFileSync(filePath);
    const blob = new Blob([fileBuffer]);
    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('filename', fileName);

    const response = await fetch(`${this.baseEndpoint}/api/v1/video/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errText}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      storagePath: string;
      fileName: string;
    };

    if (onProgress) onProgress(`Upload complete: ${result.storagePath}`);
    return { storagePath: result.storagePath, fileName: result.fileName };
  }

  /**
   * Transcribe a video (NDJSON streaming).
   */
  async transcribe(
    storagePath: string,
    fileName: string,
    keywords?: string,
    onProgress?: (message: string) => void
  ): Promise<{
    segments: TranscriptSegment[];
    videoPath: string;
    duration: number;
    projectId: string;
  }> {
    const response = await fetch(`${this.baseEndpoint}/api/video/transcribe`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ storagePath, fileName, keywords }),
    });

    return readNdjsonResponse(response, onProgress);
  }

  /**
   * AI semantic analysis of transcript segments (NDJSON streaming).
   */
  async analyze(
    segments: TranscriptSegment[],
    videoDuration: number,
    projectId?: string,
    onProgress?: (message: string) => void
  ): Promise<{ segments: VideoSegment[] }> {
    const response = await fetch(`${this.baseEndpoint}/api/video/analyze`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ segments, videoDuration, projectId }),
    });

    return readNdjsonResponse(response, onProgress);
  }

  /**
   * Split video into clips (NDJSON streaming).
   */
  async split(
    videoPath: string,
    segments: { start: number; end: number; title: string; segmentId?: string }[],
    projectId?: string,
    onProgress?: (message: string) => void
  ): Promise<{
    segments: { path: string; storagePath?: string; title: string; publicUrl?: string }[];
  }> {
    const response = await fetch(`${this.baseEndpoint}/api/video/split`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ videoPath, segments, projectId }),
    });

    return readNdjsonResponse(response, onProgress);
  }

  /**
   * Re-transcribe an existing project (NDJSON streaming).
   */
  async retranscribe(
    projectId: string,
    keywords?: string,
    onProgress?: (message: string) => void
  ): Promise<{ segments: TranscriptSegment[]; duration: number }> {
    const response = await fetch(
      `${this.baseEndpoint}/api/video/retranscribe`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ projectId, keywords }),
      }
    );

    return readNdjsonResponse(response, onProgress);
  }

  /**
   * List all video projects for the authenticated user.
   */
  async listProjects(): Promise<VideoProject[]> {
    const response = await fetch(`${this.baseEndpoint}/api/video/projects`, {
      method: 'GET',
      headers: this.headers(false),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to list projects: ${response.status} ${errText}`);
    }

    const result = (await response.json()) as { projects: VideoProject[] };
    return result.projects;
  }

  /**
   * Get a single project with all its segments.
   */
  async getProject(id: string): Promise<VideoProjectDetail> {
    const response = await fetch(
      `${this.baseEndpoint}/api/video/projects/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers: this.headers(false),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to get project: ${response.status} ${errText}`);
    }

    return (await response.json()) as VideoProjectDetail;
  }

  /**
   * Delete a project and all its associated storage files.
   */
  async deleteProject(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseEndpoint}/api/video/projects/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: this.headers(false),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Failed to delete project: ${response.status} ${errText}`
      );
    }
  }

  /**
   * Download a clip from a public URL to a local file.
   */
  async downloadClip(
    url: string,
    outputPath: string,
    onProgress?: (message: string) => void
  ): Promise<void> {
    const { writeFileSync, mkdirSync } = await import('fs');
    const { dirname } = await import('path');

    if (onProgress) onProgress(`Downloading clip...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, buffer);

    if (onProgress) onProgress(`Saved to ${outputPath}`);
  }
}
