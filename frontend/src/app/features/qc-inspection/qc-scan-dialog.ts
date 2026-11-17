import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { equipmentIdInQrPayload } from '../../core/qc/equipment-qr';
import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { QcInspectionsGateway } from '../../core/qc/qc-inspections-gateway';
import {
  CameraFailure,
  cameraFailureOf,
  QrCameraScanner,
  QrScanSession,
} from '../../core/qc/qr-camera-scanner';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';

type ScanState =
  | { readonly kind: 'starting' }
  | { readonly kind: 'scanning'; readonly invalidCode: boolean }
  | { readonly kind: 'looking-up' }
  /** A recognised code that cannot be recorded on, or a camera that cannot be used. */
  | { readonly kind: 'stopped'; readonly message: string };

export const INVALID_QR =
  'QR نامعتبر است؛ این کد متعلق به تجهیزات کابلان نیست. QR چسبانده شده روی تجهیز را اسکن کنید.';

const CAMERA_MESSAGES: Readonly<Record<CameraFailure, string>> = {
  denied:
    'اجازهٔ دسترسی به دوربین داده نشد. دسترسی دوربین را برای این سایت در تنظیمات مرورگر فعال کنید و دوباره تلاش کنید.',
  missing: 'دوربینی روی این دستگاه پیدا نشد.',
  unsupported: 'این مرورگر به دوربین دسترسی ندارد؛ صفحه باید با اتصال امن (https) باز شده باشد.',
  busy: 'دوربین در اختیار برنامهٔ دیگری است؛ آن را ببندید و دوباره تلاش کنید.',
  failed: 'دوربین باز نشد. دوباره تلاش کنید.',
};

/** Why the equipment a code names cannot be inspected now, or `undefined` when it can. */
function notRecordable(equipment: AppQcEquipment): string | undefined {
  if (equipment.retired) {
    return `تجهیز «${equipment.name}» کنار گذاشته شده است؛ برای آن انجام فعالیت QC ثبت نمی‌شود.`;
  }
  if (equipment.activities.length === 0) {
    return `هیچ فعالیت QC به تجهیز «${equipment.name}» تخصیص داده نشده است.`;
  }
  return undefined;
}

function lookUpFailure(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    // A malformed id is refused as a bad request; either way no such equipment.
    if (error.status === 404 || error.status === 400) {
      return 'تجهیزی با این QR پیدا نشد.';
    }
    if (error.status === 403) {
      return 'شما اجازهٔ ثبت انجام فعالیت QC را ندارید.';
    }
  }
  return 'اطلاعات تجهیز بارگذاری نشد. دوباره تلاش کنید.';
}

/**
 * «اسکن QR تجهیز» (issue #119): the device's camera, live in the dialog, reading the code on an
 * equipment. The code's text is `CABLAN-EQ:<id>`; anything else is «QR نامعتبر است» and scanning goes
 * on. A recognised code stops the camera and reads the equipment's inspection view: one that can be
 * recorded on closes the dialog with it (the page opens the recording dialog); a retired equipment,
 * one with no activity assigned, or an unknown one is said here, with «اسکن دوباره». A camera that
 * cannot be had — refused, absent, busy, or a browser without camera access — is said the same way.
 *
 * The camera is `QrCameraScanner`, a thin adapter a spec replaces; it is released whenever the dialog
 * closes. Nothing here records anything.
 */
@Component({
  selector: 'app-qc-scan-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      heading="اسکن QR تجهیز"
      subtitle="QR چسبانده شده روی تجهیز را جلوی دوربین بگیرید."
    />

    <mat-dialog-content class="stack stack--tight">
      <div class="scan-viewport" [class.scan-viewport--off]="!cameraOn()">
        <!-- The camera's picture; muted and inline so a phone plays it in place. -->
        <video #video class="scan-viewport__video" muted playsinline aria-hidden="true"></video>
        @if (cameraOn()) {
          <span class="scan-viewport__frame" aria-hidden="true"></span>
        }
      </div>

      <p class="scan-status" role="status">{{ status() }}</p>

      @if (alert(); as message) {
        <app-error-banner [message]="message" />
      }
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" mat-dialog-close><mat-icon appIcon="cancel" />انصراف</button>
      @if (state().kind === 'stopped') {
        <button matButton="filled" type="button" (click)="scanAgain()">
          <mat-icon appIcon="qr-code" />
          اسکن دوباره
        </button>
      }
    </mat-dialog-actions>
  `,
  styleUrl: './qc-scan-dialog.scss',
})
export class QcScanDialog {
  private readonly dialogRef = inject(MatDialogRef<QcScanDialog, AppQcEquipment>);
  private readonly camera = inject(QrCameraScanner);
  private readonly inspections = inject(QcInspectionsGateway);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly state = signal<ScanState>({ kind: 'starting' });
  private session: QrScanSession | undefined;
  private destroyed = false;

  protected readonly cameraOn = computed(() => this.state().kind === 'scanning');

  protected readonly status = computed(() => {
    switch (this.state().kind) {
      case 'starting':
        return 'در حال باز کردن دوربین…';
      case 'scanning':
        return 'در انتظار QR تجهیز…';
      case 'looking-up':
        return 'QR خوانده شد؛ در حال یافتن تجهیز…';
      case 'stopped':
        return 'اسکن متوقف شد.';
    }
  });

  protected readonly alert = computed(() => {
    const state = this.state();
    if (state.kind === 'stopped') {
      return state.message;
    }
    return state.kind === 'scanning' && state.invalidCode ? INVALID_QR : undefined;
  });

  constructor() {
    afterNextRender(() => void this.startCamera());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stopCamera();
    });
  }

  protected scanAgain(): void {
    void this.startCamera();
  }

  private async startCamera(): Promise<void> {
    this.state.set({ kind: 'starting' });
    try {
      const session = await this.camera.start(this.video().nativeElement, (text) =>
        this.onText(text),
      );
      if (this.destroyed) {
        session.stop();
        return;
      }
      this.session = session;
      this.state.set({ kind: 'scanning', invalidCode: false });
    } catch (error) {
      this.state.set({ kind: 'stopped', message: CAMERA_MESSAGES[cameraFailureOf(error)] });
    }
  }

  private stopCamera(): void {
    this.session?.stop();
    this.session = undefined;
  }

  /** Every decoded frame — the same code arrives many times while it stays in view. */
  private onText(text: string): void {
    if (this.state().kind !== 'scanning') {
      return;
    }
    const equipmentId = equipmentIdInQrPayload(text);
    if (equipmentId === undefined) {
      this.state.set({ kind: 'scanning', invalidCode: true });
      return;
    }
    this.state.set({ kind: 'looking-up' });
    this.stopCamera();
    void this.lookUp(equipmentId);
  }

  private async lookUp(equipmentId: string): Promise<void> {
    try {
      const equipment = await firstValueFrom(this.inspections.get(equipmentId));
      const refusal = notRecordable(equipment);
      if (refusal === undefined) {
        this.dialogRef.close(equipment);
      } else {
        this.state.set({ kind: 'stopped', message: refusal });
      }
    } catch (error) {
      this.state.set({ kind: 'stopped', message: lookUpFailure(error) });
    }
  }
}
