import type { SerializedMusicMap } from './sectionFromAnalysis';
import type { ExtractRequest, ExtractResponse } from './extractProtocol';

/**
 * Spawn the essentia worker, transfer the uploaded ArrayBuffer, and
 * resolve with the SerializedMusicMap. One worker per extract so a
 * failed run cannot poison the next.
 */
export function extractMusicMap(
  buffer: ArrayBuffer,
  name: string,
): Promise<SerializedMusicMap> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./musicMap.worker.ts', import.meta.url), {
      type: 'module',
    });
    const fail = (error: string) => {
      worker.terminate();
      reject(new Error(error));
    };
    worker.onmessage = (event: MessageEvent<ExtractResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.map);
      else fail(event.data.error);
    };
    worker.onerror = (event) => fail(event.message || 'Music Map worker failed');
    const request: ExtractRequest = { buffer, name };
    worker.postMessage(request, [buffer]);
  });
}
