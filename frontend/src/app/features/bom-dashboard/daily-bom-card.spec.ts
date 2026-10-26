import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppBomDashboardDailyBom } from '../../core/bom-dashboard/bom-dashboard-gateway';
import { DailyBomCard } from './daily-bom-card';
import { DailyBomDescriptionDialog } from './daily-bom-description-dialog';
import { DailyBomRejectionDialog, DailyBomRejectionOutcome } from './daily-bom-rejection-dialog';

const pendingBom: AppBomDashboardDailyBom = {
  id: 'bom-2',
  orderNumber: 'ORD-5002',
  trackingNumber: 'TRK-6002',
  registeredAt: '2024-06-21T10:00:00.000Z',
  registeredBy: 'نیکروش',
  description: 'نوسان دستگاه شماره ۲',
  standardBomMiCode: '1001',
  approvalStatus: 'pending',
  reviewedBy: null,
  managementNote: null,
  lines: [
    {
      componentId: 'c1',
      componentName: 'مغزی',
      materialId: 'm1',
      materialName: 'مسی',
      actualWeight: 3,
      standardWeight: 2,
      difference: 1,
    },
    {
      componentId: 'c2',
      componentName: 'روکش',
      materialId: 'm2',
      materialName: 'آلومینیوم',
      actualWeight: 6,
      standardWeight: 8.5,
      difference: 2.5,
    },
  ],
};

const approvedBom: AppBomDashboardDailyBom = {
  ...pendingBom,
  approvalStatus: 'approved',
  reviewedBy: 'مصطفی',
};

const rejectedBom: AppBomDashboardDailyBom = {
  ...pendingBom,
  approvalStatus: 'rejected',
  reviewedBy: 'یاشار',
  managementNote: 'وزن مس خارج از محدوده است',
};

function setUp(bom: AppBomDashboardDailyBom, canApprove: boolean) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const snackBar = vi
    .spyOn(TestBed.inject(MatSnackBar), 'open')
    .mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);
  // A dialog closes however a spec says: the description one with `true` once it saved, the
  // rejection one with its outcome, either with `undefined` on cancel.
  const dialogClosed = new Subject<boolean | DailyBomRejectionOutcome | undefined>();
  const dialog = vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
    afterClosed: (): Observable<boolean | DailyBomRejectionOutcome | undefined> => dialogClosed,
  } as MatDialogRef<unknown>);

  const fixture = TestBed.createComponent(DailyBomCard);
  fixture.componentRef.setInput('bom', bom);
  fixture.componentRef.setInput('canApprove', canApprove);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  tick();

  return {
    fixture,
    changed,
    snackBar,
    dialog,
    dialogClosed,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

/** Lets a save's `await` chain finish, then renders what it left. */
async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

function buttonNamed(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name,
  );
}

const text = (root: HTMLElement, selector: string) =>
  root.querySelector(selector)?.textContent?.trim();

const weightInput = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('input[aria-label="وزن مواد اولیه مسی جز مغزی"]');

const lineTable = (root: HTMLElement) => root.querySelector('[aria-label="اجزا و مواد اولیه"]');

const lineHeaders = (root: HTMLElement) =>
  Array.from(lineTable(root)?.querySelectorAll('thead th') ?? []).map((th) =>
    th.textContent?.trim(),
  );

const lineRows = (root: HTMLElement) =>
  Array.from(lineTable(root)?.querySelectorAll('tbody tr') ?? []).map((row) =>
    Array.from(row.querySelectorAll<HTMLElement>('td')),
  );

/** A cell's text as a sighted reader sees it — the difference pill's spoken words left out. */
function visibleText(cell: HTMLElement): string | undefined {
  const copy = cell.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.visually-hidden').forEach((hidden) => hidden.remove());
  return copy.textContent?.trim();
}

/** Column positions in the lines table. */
const STANDARD = 2;
const DIFFERENCE = 3;

describe('DailyBomCard', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('heads the card with its order number, operator, approval status and reviewer', () => {
    const { root } = setUp(approvedBom, false);

    expect(text(root, '.analysis__order-number')).toBe('ORD-5002');
    expect(text(root, '.analysis__operator')).toBe('نیکروش');
    expect(text(root, '.analysis__approval-status')).toBe('تایید');
    expect(text(root, '.analysis__reviewed-by')).toBe('مصطفی');
  });

  it('shows the tracking number beside the order number, labelled «شماره ردیابی»', () => {
    const { root } = setUp(approvedBom, false);

    const tracking = root.querySelector('.analysis__tracking-number');
    expect(tracking?.textContent?.trim()).toBe('TRK-6002');
    expect(tracking?.closest('.kv')?.querySelector('.kv__label')?.textContent?.trim()).toBe(
      'شماره ردیابی',
    );
    const order = root.querySelector('.analysis__order-number')?.closest('.kv');
    expect(order?.nextElementSibling).toBe(tracking?.closest('.kv'));
  });

  it('labels the reviewer «تایید/رد کننده»', () => {
    const { root } = setUp(approvedBom, false);

    const reviewer = root.querySelector('.analysis__reviewed-by')?.closest('.kv');
    expect(reviewer?.querySelector('.kv__label')?.textContent?.trim()).toBe('تایید/رد کننده');
  });

  it('shows a pending daily BOM with a plain hyphen for its reviewer', () => {
    const { root } = setUp(pendingBom, false);

    expect(text(root, '.analysis__approval-status')).toBe('در انتظار تایید');
    expect(text(root, '.analysis__reviewed-by')).toBe('-');
  });

  it('shows a rejected daily BOM with whoever rejected it', () => {
    const { root } = setUp(rejectedBom, false);

    expect(text(root, '.analysis__approval-status')).toBe('عدم تایید');
    expect(text(root, '.analysis__reviewed-by')).toBe('یاشار');
  });

  it('shows the management note under its label, and no note while there is none', () => {
    const { root } = setUp(rejectedBom, false);

    const note = root.querySelector('.analysis__management-note');
    expect(note?.textContent?.trim()).toBe('وزن مس خارج از محدوده است');
    expect(note?.closest('.kv')?.querySelector('.kv__label')?.textContent?.trim()).toBe(
      'توضیحات مدیریت',
    );

    TestBed.resetTestingModule();
    const pending = setUp(pendingBom, false);
    expect(pending.root.querySelector('.analysis__management-note')).toBeNull();
  });

  it('shows each line by component, material, standard weight, difference and registered weight', () => {
    const { root } = setUp(pendingBom, false);

    expect(lineHeaders(root)).toEqual([
      'نام جز',
      'نام مواد اولیه',
      'وزن استاندارد',
      'اختلاف وزن',
      'وزن ثبت‌شده',
    ]);
    expect(lineRows(root).map((cells) => cells.map(visibleText))).toEqual([
      ['مغزی', 'مسی', '۲', '۱', '۳'],
      ['روکش', 'آلومینیوم', '۸٫۵', '۲٫۵', '۶'],
    ]);
  });

  it('keeps the edit column after the registered weight for a role that may approve', () => {
    const { root } = setUp(pendingBom, true);

    expect(lineHeaders(root)).toEqual([
      'نام جز',
      'نام مواد اولیه',
      'وزن استاندارد',
      'اختلاف وزن',
      'وزن ثبت‌شده',
      'ویرایش',
    ]);
  });

  it('points the difference up for a line above its standard and down for one below it', () => {
    const { root } = setUp(pendingBom, false);

    const [above, below] = lineRows(root).map((cells) => cells[DIFFERENCE]!);
    expect(above!.querySelector('.weight-difference--above')).not.toBeNull();
    expect(above!.querySelector('.visually-hidden')?.textContent?.trim()).toBe(
      'بیشتر از استاندارد',
    );
    expect(below!.querySelector('.weight-difference--below')).not.toBeNull();
    expect(below!.querySelector('.visually-hidden')?.textContent?.trim()).toBe('کمتر از استاندارد');
  });

  it('leaves the difference cell empty for a line on its standard', () => {
    const { root } = setUp(
      {
        ...pendingBom,
        lines: [{ ...pendingBom.lines[0]!, actualWeight: 2, standardWeight: 2, difference: 0 }],
      },
      false,
    );

    const [cells] = lineRows(root);
    expect(cells![STANDARD]!.textContent?.trim()).toBe('۲');
    expect(cells![DIFFERENCE]!.textContent?.trim()).toBe('');
    expect(cells![DIFFERENCE]!.querySelector('app-weight-difference')).toBeNull();
  });

  it('offers neither approval nor weight edits to a role that may not approve', () => {
    const { root } = setUp(pendingBom, false);

    expect(buttonNamed(root, 'تایید')).toBeUndefined();
    expect(buttonNamed(root, 'عدم تایید')).toBeUndefined();
    expect(buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')).toBeUndefined();
  });

  it('offers «تایید» and «عدم تایید» on a pending daily BOM', () => {
    const { root } = setUp(pendingBom, true);

    expect(buttonNamed(root, 'تایید')?.type).toBe('button');
    expect(buttonNamed(root, 'عدم تایید')?.type).toBe('button');
    expect(buttonNamed(root, 'لغو تایید')).toBeUndefined();
  });

  it.each([
    ['approved', approvedBom],
    ['rejected', rejectedBom],
  ] as const)(
    'offers no review on an %s daily BOM — only an edit sends it back',
    (_status, bom) => {
      const { root } = setUp(bom, true);

      expect(buttonNamed(root, 'تایید')).toBeUndefined();
      expect(buttonNamed(root, 'عدم تایید')).toBeUndefined();
      expect(buttonNamed(root, 'لغو تایید')).toBeUndefined();
      expect(buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')).toBeDefined();
    },
  );

  it('approves, holds the button while the request is out, and asks for the list to be re-read', () => {
    const { root, httpMock, changed } = setUp(pendingBom, true);

    buttonNamed(root, 'تایید')?.dispatchEvent(new Event('click'));
    tick();
    expect(buttonNamed(root, 'تایید')?.disabled).toBe(true);

    const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/bom-2/approval' });
    expect(changed).not.toHaveBeenCalled();
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(changed).toHaveBeenCalledOnce();
  });

  it.each([
    [403, { title: 'Forbidden' }, 'شما اجازهٔ تایید آنالیز روزانه را ندارید.'],
    [500, { title: 'Server Error' }, 'تایید آنالیز روزانه انجام نشد.'],
  ])(
    'says so when the approval answers %i, and lets the visitor try again',
    (status, body, message) => {
      const { root, httpMock, changed, snackBar } = setUp(pendingBom, true);

      buttonNamed(root, 'تایید')?.dispatchEvent(new Event('click'));
      httpMock
        .expectOne({ method: 'POST', url: '/api/boms/bom-2/approval' })
        .flush(body, { status, statusText: 'Failed' });
      tick();

      expect(changed).not.toHaveBeenCalled();
      expect(snackBar).toHaveBeenCalledWith(message, 'باشه', expect.anything());
      expect(buttonNamed(root, 'تایید')?.disabled).toBe(false);
    },
  );

  it('says the daily BOM was already reviewed, and re-reads the list to show by whom', () => {
    const { root, httpMock, changed, snackBar } = setUp(pendingBom, true);

    buttonNamed(root, 'تایید')?.dispatchEvent(new Event('click'));
    httpMock.expectOne({ method: 'POST', url: '/api/boms/bom-2/approval' }).flush(
      {
        type: 'https://my-api-doc.dev/problems/bom-already-reviewed',
        title: 'BOM Already Reviewed',
        status: 409,
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(snackBar).toHaveBeenCalledWith(
      'این آنالیز روزانه پیش‌تر بررسی شده است؛ برای بررسی دوباره ابتدا آن را ویرایش کنید.',
      'باشه',
      expect.anything(),
    );
    expect(changed).toHaveBeenCalledOnce();
  });

  describe('rejecting', () => {
    it('opens the rejection dialog on the daily BOM, named by its order number', () => {
      const { root, dialog } = setUp(pendingBom, true);

      buttonNamed(root, 'عدم تایید')?.dispatchEvent(new Event('click'));

      expect(dialog).toHaveBeenCalledWith(
        DailyBomRejectionDialog,
        expect.objectContaining({ data: { bomId: 'bom-2', orderNumber: 'ORD-5002' } }),
      );
    });

    it('asks for the list to be re-read once the dialog rejected it', () => {
      const { root, changed, snackBar, dialogClosed } = setUp(pendingBom, true);
      buttonNamed(root, 'عدم تایید')?.dispatchEvent(new Event('click'));

      dialogClosed.next('rejected');

      expect(changed).toHaveBeenCalledOnce();
      expect(snackBar).not.toHaveBeenCalled();
    });

    it('says the daily BOM was already reviewed, and re-reads the list to show by whom', () => {
      const { root, changed, snackBar, dialogClosed } = setUp(pendingBom, true);
      buttonNamed(root, 'عدم تایید')?.dispatchEvent(new Event('click'));

      dialogClosed.next('already-reviewed');

      expect(snackBar).toHaveBeenCalledWith(
        'این آنالیز روزانه پیش‌تر بررسی شده است؛ برای بررسی دوباره ابتدا آن را ویرایش کنید.',
        'باشه',
        expect.anything(),
      );
      expect(changed).toHaveBeenCalledOnce();
    });

    it('asks for nothing when the dialog was cancelled', () => {
      const { root, changed, dialogClosed } = setUp(pendingBom, true);
      buttonNamed(root, 'عدم تایید')?.dispatchEvent(new Event('click'));

      dialogClosed.next(undefined);

      expect(changed).not.toHaveBeenCalled();
    });
  });

  it("opens a line's weight for editing, filled with its current weight", async () => {
    const { root, fixture } = setUp(pendingBom, true);
    expect(weightInput(root)).toBeNull();

    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(weightInput(root)?.value).toBe('3');
    expect(buttonNamed(root, 'ذخیره')).toBeDefined();
  });

  it('saves the whole composition with the one weight changed, closing the input once answered', async () => {
    const { root, fixture, httpMock, changed } = setUp(pendingBom, true);
    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    const input = weightInput(root)!;
    input.value = '2';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-2' });
    expect(request.request.body).toEqual({
      standardBomMiCode: '1001',
      components: [
        { componentId: 'c1', materials: [{ materialId: 'm1', weight: 2 }] },
        { componentId: 'c2', materials: [{ materialId: 'm2', weight: 6 }] },
      ],
    });
    expect(weightInput(root)).not.toBeNull();

    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    expect(weightInput(root)).toBeNull();
    expect(changed).toHaveBeenCalledOnce();
  });

  it('refuses a weight that is not a positive number, without a request', async () => {
    const { root, fixture } = setUp(pendingBom, true);
    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    const input = weightInput(root)!;
    input.value = '0';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent?.trim()).toBe(
      'وزن مواد اولیه را به صورت عدد مثبت وارد کنید.',
    );
  });

  it('keeps the input open and says so when the save fails', async () => {
    const { root, fixture, httpMock, changed, snackBar } = setUp(pendingBom, true);
    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/boms/bom-2' })
      .flush({ title: 'Server Error' }, { status: 500, statusText: 'Server Error' });
    await settle(fixture);

    expect(weightInput(root)).not.toBeNull();
    expect(changed).not.toHaveBeenCalled();
    expect(snackBar).toHaveBeenCalledWith('وزن مواد اولیه ذخیره نشد.', 'باشه', expect.anything());
  });

  it('closes the input without saving on «انصراف»', async () => {
    const { root, fixture } = setUp(pendingBom, true);
    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    buttonNamed(root, 'انصراف')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(weightInput(root)).toBeNull();
  });

  it("puts focus back on the line's pencil once the re-read daily BOM arrives", async () => {
    const { root, fixture, httpMock } = setUp(pendingBom, true);
    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/boms/bom-2' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    (document.activeElement as HTMLElement | null)?.blur();

    // The page's re-read hands the card a new object, and the table renders its rows afresh.
    fixture.componentRef.setInput('bom', {
      ...pendingBom,
      lines: pendingBom.lines.map((line) => ({ ...line })),
    });
    await fixture.whenStable();

    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'ویرایش وزن مواد اولیه مسی جز مغزی',
    );
  });

  it("shows the corrected line's new difference once the re-read daily BOM arrives", async () => {
    const { root, fixture, httpMock } = setUp(pendingBom, true);
    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    const input = weightInput(root)!;
    input.value = '1.5';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/boms/bom-2' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    // The API re-computes the difference: 1.5 against a standard of 2 is now 0.5 below it.
    fixture.componentRef.setInput('bom', {
      ...pendingBom,
      lines: [
        { ...pendingBom.lines[0]!, actualWeight: 1.5, difference: 0.5 },
        pendingBom.lines[1]!,
      ],
    });
    await fixture.whenStable();

    const [corrected] = lineRows(root);
    expect(visibleText(corrected![DIFFERENCE]!)).toBe('۰٫۵');
    expect(corrected![DIFFERENCE]!.querySelector('.weight-difference--below')).not.toBeNull();
    expect(visibleText(corrected![4]!)).toBe('۱٫۵');
  });

  it('moves focus to the card header once the approval has been re-read and its buttons are gone', async () => {
    const { root, fixture, httpMock } = setUp(pendingBom, true);
    buttonNamed(root, 'تایید')?.dispatchEvent(new Event('click'));
    httpMock
      .expectOne({ method: 'POST', url: '/api/boms/bom-2/approval' })
      .flush(null, { status: 204, statusText: 'No Content' });

    fixture.componentRef.setInput('bom', approvedBom);
    await fixture.whenStable();

    expect(document.activeElement?.tagName.toLowerCase()).toBe('mat-expansion-panel-header');
    expect(root.contains(document.activeElement)).toBe(true);
  });

  it('moves focus to the card header once a rejection has been re-read', async () => {
    const { root, fixture, dialogClosed } = setUp(pendingBom, true);
    buttonNamed(root, 'عدم تایید')?.dispatchEvent(new Event('click'));
    dialogClosed.next('rejected');

    fixture.componentRef.setInput('bom', rejectedBom);
    await fixture.whenStable();

    expect(document.activeElement?.tagName.toLowerCase()).toBe('mat-expansion-panel-header');
  });

  it("explains a save refused because a line is no longer in the standard BOM's composition", async () => {
    const { root, fixture, httpMock, snackBar } = setUp(pendingBom, true);
    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-2' }).flush(
      {
        type: 'https://my-api-doc.dev/problems/bom-composition-entry-not-found',
        title: 'Not Found',
        status: 404,
      },
      { status: 404, statusText: 'Not Found' },
    );
    await settle(fixture);

    expect(snackBar).toHaveBeenCalledWith(
      'این آنالیز روزانه اجزا یا مواد اولیه‌ای دارد که دیگر در آنالیز استاندارد نیست؛ ویرایش وزن ممکن نیست.',
      'باشه',
      expect.anything(),
    );
  });

  it.each(['تایید', 'عدم تایید'])(
    "names the review button exactly «%s» and describes it by the card's order number",
    (name) => {
      const { root } = setUp(pendingBom, true);

      const button = buttonNamed(root, name);
      expect(button?.getAttribute('aria-label')).toBeNull();
      expect(button?.textContent?.trim()).toBe(name);
      const describedBy = button?.getAttribute('aria-describedby') ?? '';
      const description = describedBy
        .split(' ')
        .map((id) => root.querySelector(`[id="${id}"]`)?.textContent?.trim())
        .join(' ');
      expect(description).toContain('ORD-5002');
    },
  );

  describe('the description', () => {
    const DESCRIPTION_PENCIL = 'ویرایش توضیحات';

    it('shows the description, or a dash when there is none', () => {
      const { root } = setUp(pendingBom, false);
      expect(text(root, '.analysis__description')).toBe('نوسان دستگاه شماره ۲');

      TestBed.resetTestingModule();
      const empty = setUp({ ...pendingBom, description: '' }, false);
      expect(text(empty.root, '.analysis__description')).toBe('—');
    });

    it('offers no description pencil to a role that may not approve', () => {
      const { root } = setUp(pendingBom, false);

      expect(buttonNamed(root, DESCRIPTION_PENCIL)).toBeUndefined();
    });

    it("offers a description pencil, described by the card's order number, to a role that may approve", () => {
      const { root } = setUp(pendingBom, true);

      const pencil = buttonNamed(root, DESCRIPTION_PENCIL);
      expect(pencil?.type).toBe('button');
      const describedBy = pencil?.getAttribute('aria-describedby') ?? '';
      expect(root.querySelector(`[id="${describedBy}"]`)?.textContent?.trim()).toBe('ORD-5002');
    });

    it('opens the description dialog on the daily BOM and its current description', () => {
      const { root, dialog } = setUp(pendingBom, true);

      buttonNamed(root, DESCRIPTION_PENCIL)?.dispatchEvent(new Event('click'));

      expect(dialog).toHaveBeenCalledWith(
        DailyBomDescriptionDialog,
        expect.objectContaining({
          data: { bomId: 'bom-2', description: 'نوسان دستگاه شماره ۲' },
        }),
      );
    });

    it('asks for the list to be re-read once the dialog saved', () => {
      const { root, changed, dialogClosed } = setUp(pendingBom, true);
      buttonNamed(root, DESCRIPTION_PENCIL)?.dispatchEvent(new Event('click'));

      dialogClosed.next(true);

      expect(changed).toHaveBeenCalledOnce();
    });

    it('asks for nothing when the dialog was cancelled', () => {
      const { root, changed, dialogClosed } = setUp(pendingBom, true);
      buttonNamed(root, DESCRIPTION_PENCIL)?.dispatchEvent(new Event('click'));

      dialogClosed.next(undefined);

      expect(changed).not.toHaveBeenCalled();
    });

    it('puts focus back on the description pencil once the re-read daily BOM arrives', async () => {
      const { root, fixture, dialogClosed } = setUp(pendingBom, true);
      buttonNamed(root, DESCRIPTION_PENCIL)?.dispatchEvent(new Event('click'));
      dialogClosed.next(true);
      (document.activeElement as HTMLElement | null)?.blur();

      fixture.componentRef.setInput('bom', { ...pendingBom, description: 'دستگاه تنظیم شد' });
      await fixture.whenStable();

      expect(document.activeElement?.getAttribute('aria-label')).toBe(DESCRIPTION_PENCIL);
    });
  });
});
