/**
 * NDJSON streaming response reader.
 * Parses newline-delimited JSON messages from a fetch Response.
 */

export interface NdjsonMessage {
  type: 'progress' | 'success' | 'error';
  message?: string;
  data?: unknown;
  error?: string;
}

/**
 * Read an NDJSON streaming response, calling onProgress for each progress message.
 * Returns the final success data, or throws on error.
 */
export async function readNdjsonResponse<T = unknown>(
  response: Response,
  onProgress?: (message: string) => void
): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let result: T | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Keep the last incomplete line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let msg: NdjsonMessage;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        continue;
      }

      switch (msg.type) {
        case 'progress':
          if (onProgress && msg.message) {
            onProgress(msg.message);
          }
          break;
        case 'success':
          result = msg.data as T;
          break;
        case 'error':
          throw new Error(msg.error ?? 'Unknown streaming error');
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const msg: NdjsonMessage = JSON.parse(buffer.trim());
      if (msg.type === 'success') {
        result = msg.data as T;
      } else if (msg.type === 'error') {
        throw new Error(msg.error ?? 'Unknown streaming error');
      }
    } catch {
      // ignore incomplete final line
    }
  }

  if (result === undefined) {
    throw new Error('Stream ended without a success message');
  }

  return result;
}
