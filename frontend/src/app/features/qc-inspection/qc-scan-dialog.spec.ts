import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import {
  CameraFailure,
  CameraUnavailableError,
  QrCameraScanner,
} from '../../core/qc/qr-camera-scanner';
import { QcScanDialog } from './qc-scan-dialog';

const ID = '550e8400-e29b-41d4-a716-446655440000';
const INSPECTION = { method: 'GET', url: `/api/qc-inspections/${ID}` };
const FOLDER = {
  id: ID,
  name: 'اکسترودر 1',
  retired: false,
  activities: [{ activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null }],
};

/** A camera that decodes whatever the spec shows it. */
class FakeCamera {
  readonly stop = vi.fn();
  private onText: ((text: string) => void) | undefined;
  failure: CameraFailure | undefined;
  starts = 0;

  start(_video: HTMLVideoElement, onText: (text: string) => void) {
    this.starts += 1;
    if (this.failure !== undefined) {
      return Promise.reject(new CameraUnavailableError(this.failure));
    }
    this.onText = onText;
    return Promise.resolve({ stop: this.stop });
  }

  show(text: string): void {
    this.onText?.(text);
  }
}

async function setUp(failure?: CameraFailure) {
  const camera = new FakeCamera();
  camera.failure = failure;
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: QrCameraScanner, useValue: camera },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(QcScanDialog);
  await fixture.whenStable();
  await vi.waitFor(() => expect(camera.starts).toBe(1));
  await fixture.whenStable();
  return {
    camera,
    close,
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

const alertText = (root: HTMLElement) => root.querySelector('[role="alert"]')?.textContent ?? '';

describe('QcScanDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('opens the camera as it opens, under «اسکن QR تجهیز»', async () => {
    const { root } = await setUp();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('اسکن QR تجهیز');
    expect(root.querySelector('video')).not.toBeNull();
  });

  it('reads a Cablan equipment code, stops the camera and closes with the equipment', async () => {
    const { camera, close, fixture, httpMock } = await setUp();

    camera.show(`CABLAN-EQ:${ID}`);
    camera.show(`CABLAN-EQ:${ID}`);
    httpMock.expectOne(INSPECTION).flush(FOLDER);
    await fixture.whenStable();

    expect(camera.stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith({
      id: ID,
      name: 'اکسترودر 1',
      retired: false,
      activities: [{ activityId: 'q1', activityName: 'بازرسی ابعادی', lastPerformedAt: null }],
    });
  });

  it('says a code that is not one of ours is invalid, and keeps scanning', async () => {
    const { camera, close, fixture, root } = await setUp();

    camera.show('https://example.com');
    await fixture.whenStable();

    expect(alertText(root)).toContain('QR نامعتبر است');
    expect(camera.stop).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a retired equipment',
      { ...FOLDER, retired: true },
      'تجهیز «اکسترودر 1» کنار گذاشته شده است؛ برای آن انجام فعالیت QC ثبت نمی‌شود.',
    ],
    [
      'an equipment with no activity assigned',
      { ...FOLDER, activities: [] },
      'هیچ فعالیت QC به تجهیز «اکسترودر 1» تخصیص داده نشده است.',
    ],
  ])('says so for %s and records nothing', async (_, folder, message) => {
    const { camera, close, fixture, httpMock, root } = await setUp();

    camera.show(`CABLAN-EQ:${ID}`);
    httpMock.expectOne(INSPECTION).flush(folder);
    await fixture.whenStable();

    expect(alertText(root)).toContain(message);
    expect(close).not.toHaveBeenCalled();
  });

  it('says an unknown equipment was not found, and offers to scan again', async () => {
    const { camera, close, fixture, httpMock, root } = await setUp();

    camera.show(`CABLAN-EQ:${ID}`);
    httpMock
      .expectOne(INSPECTION)
      .flush(
        { type: PROBLEM.equipmentNotFound, status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(alertText(root)).toContain('تجهیزی با این QR پیدا نشد.');
    expect(close).not.toHaveBeenCalled();

    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'اسکن دوباره')
      ?.click();
    await vi.waitFor(() => expect(camera.starts).toBe(2));
  });

  it.each([
    ['denied', 'اجازهٔ دسترسی به دوربین داده نشد.'],
    ['missing', 'دوربینی روی این دستگاه پیدا نشد.'],
    ['unsupported', 'این مرورگر به دوربین دسترسی ندارد'],
    ['busy', 'دوربین در اختیار برنامهٔ دیگری است'],
  ] as const)('says so when the camera is %s', async (failure, message) => {
    const { root } = await setUp(failure);

    expect(alertText(root)).toContain(message);
  });

  it('releases the camera when it closes', async () => {
    const { camera, fixture } = await setUp();

    fixture.destroy();

    expect(camera.stop).toHaveBeenCalled();
  });
});
