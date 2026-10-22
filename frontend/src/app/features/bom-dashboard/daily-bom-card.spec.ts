import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppBomDashboardDailyBom } from '../../core/bom-dashboard/bom-dashboard-gateway';
import { DailyBomCard } from './daily-bom-card';

const unapprovedBom: AppBomDashboardDailyBom = {
  id: 'bom-2',
  orderNumber: 'ORD-5002',
  registeredAt: '2024-06-21T10:00:00.000Z',
  registeredBy: 'نیکروش',
  description: 'نوسان دستگاه شماره ۲',
  standardBomMiCode: '1001',
  approvalStatus: 'unapproved',
  approvedBy: null,
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
  ...unapprovedBom,
  approvalStatus: 'approved',
  approvedBy: 'مصطفی',
};

function setUp(bom: AppBomDashboardDailyBom, canApprove: boolean) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const snackBar = vi
    .spyOn(TestBed.inject(MatSnackBar), 'open')
    .mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);

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

  it('heads the card with its order number, operator, approval status and approver', () => {
    const { root } = setUp(approvedBom, false);

    expect(text(root, '.analysis__order-number')).toBe('ORD-5002');
    expect(text(root, '.analysis__operator')).toBe('نیکروش');
    expect(text(root, '.analysis__approval-status')).toBe('تایید شده');
    expect(text(root, '.analysis__approved-by')).toBe('مصطفی');
    expect(root.querySelector('.analysis__tracking')).toBeNull();
  });

  it('shows an unapproved daily BOM with a plain hyphen for its approver', () => {
    const { root } = setUp(unapprovedBom, false);

    expect(text(root, '.analysis__approval-status')).toBe('تایید نشده');
    expect(text(root, '.analysis__approved-by')).toBe('-');
  });

  it('shows each line by component, material, standard weight, difference and registered weight', () => {
    const { root } = setUp(unapprovedBom, false);

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
    const { root } = setUp(unapprovedBom, true);

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
    const { root } = setUp(unapprovedBom, false);

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
        ...unapprovedBom,
        lines: [{ ...unapprovedBom.lines[0]!, actualWeight: 2, standardWeight: 2, difference: 0 }],
      },
      false,
    );

    const [cells] = lineRows(root);
    expect(cells![STANDARD]!.textContent?.trim()).toBe('۲');
    expect(cells![DIFFERENCE]!.textContent?.trim()).toBe('');
    expect(cells![DIFFERENCE]!.querySelector('app-weight-difference')).toBeNull();
  });

  it('offers neither approval nor weight edits to a role that may not approve', () => {
    const { root } = setUp(unapprovedBom, false);

    expect(buttonNamed(root, 'تایید')).toBeUndefined();
    expect(buttonNamed(root, 'لغو تایید')).toBeUndefined();
    expect(buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')).toBeUndefined();
  });

  it('offers «تایید» on an unapproved daily BOM and «لغو تایید» on an approved one', () => {
    const { root, fixture } = setUp(unapprovedBom, true);
    expect(buttonNamed(root, 'تایید')).toBeDefined();
    expect(buttonNamed(root, 'لغو تایید')).toBeUndefined();

    fixture.componentRef.setInput('bom', approvedBom);
    tick();

    expect(buttonNamed(root, 'تایید')).toBeUndefined();
    expect(buttonNamed(root, 'لغو تایید')).toBeDefined();
  });

  it('approves, holds the button while the request is out, and asks for the list to be re-read', () => {
    const { root, httpMock, changed } = setUp(unapprovedBom, true);

    buttonNamed(root, 'تایید')?.dispatchEvent(new Event('click'));
    tick();
    expect(buttonNamed(root, 'تایید')?.disabled).toBe(true);

    const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/bom-2/approval' });
    expect(changed).not.toHaveBeenCalled();
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(changed).toHaveBeenCalledOnce();
  });

  it('revokes an approval and asks for the list to be re-read', () => {
    const { root, httpMock, changed } = setUp(approvedBom, true);

    buttonNamed(root, 'لغو تایید')?.dispatchEvent(new Event('click'));
    httpMock
      .expectOne({ method: 'DELETE', url: '/api/boms/bom-2/approval' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(changed).toHaveBeenCalledOnce();
  });

  it('says so when the approval is refused, and lets the visitor try again', () => {
    const { root, httpMock, changed, snackBar } = setUp(unapprovedBom, true);

    buttonNamed(root, 'تایید')?.dispatchEvent(new Event('click'));
    httpMock
      .expectOne({ method: 'POST', url: '/api/boms/bom-2/approval' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    tick();

    expect(changed).not.toHaveBeenCalled();
    expect(snackBar).toHaveBeenCalledWith(
      'شما اجازهٔ تایید آنالیز روزانه را ندارید.',
      'باشه',
      expect.anything(),
    );
    expect(buttonNamed(root, 'تایید')?.disabled).toBe(false);
  });

  it("opens a line's weight for editing, filled with its current weight", async () => {
    const { root, fixture } = setUp(unapprovedBom, true);
    expect(weightInput(root)).toBeNull();

    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(weightInput(root)?.value).toBe('3');
    expect(buttonNamed(root, 'ذخیره')).toBeDefined();
  });

  it('saves the whole composition with the one weight changed, closing the input once answered', async () => {
    const { root, fixture, httpMock, changed } = setUp(unapprovedBom, true);
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
    const { root, fixture } = setUp(unapprovedBom, true);
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
    const { root, fixture, httpMock, changed, snackBar } = setUp(unapprovedBom, true);
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
    const { root, fixture } = setUp(unapprovedBom, true);
    buttonNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    buttonNamed(root, 'انصراف')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(weightInput(root)).toBeNull();
  });

  it("puts focus back on the line's pencil once the re-read daily BOM arrives", async () => {
    const { root, fixture, httpMock } = setUp(unapprovedBom, true);
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
      ...unapprovedBom,
      lines: unapprovedBom.lines.map((line) => ({ ...line })),
    });
    await fixture.whenStable();

    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'ویرایش وزن مواد اولیه مسی جز مغزی',
    );
  });

  it("shows the corrected line's new difference once the re-read daily BOM arrives", async () => {
    const { root, fixture, httpMock } = setUp(unapprovedBom, true);
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
      ...unapprovedBom,
      lines: [
        { ...unapprovedBom.lines[0]!, actualWeight: 1.5, difference: 0.5 },
        unapprovedBom.lines[1]!,
      ],
    });
    await fixture.whenStable();

    const [corrected] = lineRows(root);
    expect(visibleText(corrected![DIFFERENCE]!)).toBe('۰٫۵');
    expect(corrected![DIFFERENCE]!.querySelector('.weight-difference--below')).not.toBeNull();
    expect(visibleText(corrected![4]!)).toBe('۱٫۵');
  });

  it('moves focus to «لغو تایید» once the approval has been re-read', async () => {
    const { root, fixture, httpMock } = setUp(unapprovedBom, true);
    buttonNamed(root, 'تایید')?.dispatchEvent(new Event('click'));
    httpMock
      .expectOne({ method: 'POST', url: '/api/boms/bom-2/approval' })
      .flush(null, { status: 204, statusText: 'No Content' });

    fixture.componentRef.setInput('bom', approvedBom);
    await fixture.whenStable();

    expect(document.activeElement?.textContent?.trim()).toBe('لغو تایید');
  });

  it("explains a save refused because a line is no longer in the standard BOM's composition", async () => {
    const { root, fixture, httpMock, snackBar } = setUp(unapprovedBom, true);
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

  it.each([
    ['تایید', unapprovedBom],
    ['لغو تایید', approvedBom],
  ] as const)(
    "names the review button exactly «%s» and describes it by the card's order number",
    (name, bom) => {
      const { root } = setUp(bom, true);

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
});
