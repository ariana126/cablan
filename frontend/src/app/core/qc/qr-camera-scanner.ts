import { Injectable } from '@angular/core';

/** Why the camera could not be used. */
export type CameraFailure = 'denied' | 'missing' | 'busy' | 'unsupported' | 'failed';

/** Thrown by `QrCameraScanner.start` when no camera picture can be had. */
export class CameraUnavailableError extends Error {
  constructor(readonly reason: CameraFailure) {
    super(`camera unavailable: ${reason}`);
    this.name = 'CameraUnavailableError';
  }
}

/** A running scan; `stop` releases the camera (its light goes off). Safe to call twice. */
export interface QrScanSession {
  stop(): void;
}

/** The browser's camera errors (`getUserMedia`'s `DOMException` names) as a reason to tell. */
export function cameraFailureOf(error: unknown): CameraFailure {
  if (error instanceof CameraUnavailableError) {
    return error.reason;
  }
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'DevicesNotFoundError':
      return 'missing';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'busy';
    default:
      return 'failed';
  }
}

/**
 * The real camera: `@zxing/browser`'s QR reader on the device's back camera, decoding every frame.
 * Loaded only when a scan starts, so the decoder is not in any page's bundle until it is needed.
 *
 * Deliberately thin — no wording, no payload parsing, no state: everything a visitor sees is in the
 * scan dialog, which a spec drives with a fake in this one's place (a camera cannot run in CI).
 */
@Injectable({ providedIn: 'root' })
export class ZxingQrCameraScanner {
  async start(video: HTMLVideoElement, onText: (text: string) => void): Promise<QrScanSession> {
    // Absent outside a secure context (plain http on another host) and on old browsers.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new CameraUnavailableError('unsupported');
    }
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        video,
        (result) => {
          if (result) {
            onText(result.getText());
          }
        },
      );
      return { stop: () => controls.stop() };
    } catch (error) {
      throw new CameraUnavailableError(cameraFailureOf(error));
    }
  }
}

/**
 * Reads QR codes from the device's camera into a `<video>` the caller shows. `start` resolves once
 * the picture is live and calls `onText` with the text of every code it decodes (repeatedly, while
 * one stays in view); it rejects with a `CameraUnavailableError` when there is no picture to have.
 */
@Injectable({ providedIn: 'root', useExisting: ZxingQrCameraScanner })
export abstract class QrCameraScanner {
  abstract start(video: HTMLVideoElement, onText: (text: string) => void): Promise<QrScanSession>;
}
