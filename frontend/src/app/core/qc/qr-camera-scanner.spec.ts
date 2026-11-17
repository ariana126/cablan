import { describe, expect, it } from 'vitest';

import { CameraUnavailableError, cameraFailureOf } from './qr-camera-scanner';

const domError = (name: string) => new DOMException('camera', name);

describe('cameraFailureOf', () => {
  it.each(['NotAllowedError', 'SecurityError'])('reads %s as permission refused', (name) => {
    expect(cameraFailureOf(domError(name))).toBe('denied');
  });

  it.each(['NotFoundError', 'OverconstrainedError', 'DevicesNotFoundError'])(
    'reads %s as no camera at all',
    (name) => {
      expect(cameraFailureOf(domError(name))).toBe('missing');
    },
  );

  it('reads a camera another program holds as busy', () => {
    expect(cameraFailureOf(domError('NotReadableError'))).toBe('busy');
  });

  it('keeps the reason of an error it raised itself', () => {
    expect(cameraFailureOf(new CameraUnavailableError('unsupported'))).toBe('unsupported');
  });

  it('reads anything else as a failure to open the camera', () => {
    expect(cameraFailureOf(new Error('boom'))).toBe('failed');
  });
});
