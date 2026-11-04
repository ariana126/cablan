import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { endAlignedColumns } from '../../ui/testing/end-aligned-columns';
import { ConfirmDeletePmExecutionDialog } from './confirm-delete-pm-execution-dialog';
import { PmExecutionDetailsDialog } from './pm-execution-details-dialog';
import { PmHistorySection } from './pm-history-section';
import { accessibleName, controlNamed, region, squeeze, texts } from './testing/pm-plans-queries';

const HISTORY = [
  {
    id: 'x1',
    planItemId: 'p1',
    activityName: 'تعویض روغن',
    dueDate: '2026-09-23',
    performedAt: '2026-09-23T07:00:00.000Z',
    performedBy: 'مسلمی',
    status: 'on_time',
    notes: null,
    daysLate: null,
    activitySpecialty: 'mechanical',
    operatingHours: 1250.5,
  },
];

describe('PmHistorySection — «سابقه PM» in an equipment’s folder', () => {
  let fixture: ComponentFixture<PmHistorySection>;
  let httpMock: HttpTestingController;
  let root: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PmHistorySection);
    httpMock = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    httpMock.verify();
  });

  const render = async (
    equipment = { id: 'e1', name: 'اکسترودر 1' },
    answer: (request: ReturnType<HttpTestingController['expectOne']>) => void = (request) =>
      request.flush(HISTORY),
  ): Promise<void> => {
    fixture.componentRef.setInput('equipmentId', equipment.id);
    fixture.componentRef.setInput('equipmentName', equipment.name);
    tick();
    answer(
      httpMock.expectOne({
        method: 'GET',
        url: `/api/equipment/${equipment.id}/maintenance-history`,
      }),
    );
    await fixture.whenStable();
  };

  const history = () => region(root, 'سابقه PM');

  it('shows what was done, newest first, without its notes', async () => {
    await render();

    const table = history()!.querySelector('table')!;
    expect(texts(table.querySelectorAll('thead th'))).toEqual([
      'فعالیت',
      'موعد',
      'انجام دهنده',
      'زمان انجام',
      'وضعیت',
      'عملیات',
    ]);
    const cells = texts(table.querySelectorAll('tbody tr')[0].querySelectorAll('td'));
    expect(cells.slice(0, 3)).toEqual(['تعویض روغن', '۱۴۰۵/۰۷/۰۱', 'مسلمی']);
    expect(cells[3]).toMatch(/^۱۴۰۵\/۰۷\/۰۱ [۰-۹]{2}:[۰-۹]{2}$/);
    expect(cells.slice(4)).toEqual(['بموقع', 'جزئیات']);
  });

  it('lines every value up under its own column header', async () => {
    await render();

    expect(endAlignedColumns(history()!.querySelector('table')!)).toEqual({
      headers: [false, true, false, true, false, false],
      cells: [false, true, false, true, false, false],
    });
  });

  it('opens a row’s details from its «جزئیات», named by the activity and due date', async () => {
    await render();
    const open = vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({} as MatDialogRef<unknown>);

    controlNamed(root, 'جزئیات تعویض روغن ۱۴۰۵/۰۷/۰۱')!.click();

    expect(open).toHaveBeenCalledWith(PmExecutionDetailsDialog, {
      data: { equipmentName: 'اکسترودر 1', execution: { ...HISTORY[0], notes: '' } },
    });
  });

  it('offers no deletion unless the System Admin may delete', async () => {
    await render();

    expect(controlNamed(root, 'حذف سابقه')).toBeUndefined();
  });

  describe("the System Admin's deletion of one execution (issue #110)", () => {
    beforeEach(() => {
      fixture.componentRef.setInput('canDelete', true);
    });

    const deleteButton = () => controlNamed(history()!, 'حذف سابقه') as HTMLButtonElement;

    it('offers «حذف سابقه» on each row, described by its activity and due date', async () => {
      await render();

      const button = deleteButton();
      expect(accessibleName(button)).toBe('حذف سابقه');
      const description = (button.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => squeeze(root.querySelector(`#${id}`)?.textContent))
        .join(' ');
      expect(description).toBe('تعویض روغن ۱۴۰۵/۰۷/۰۱');
    });

    it('deletes behind a confirmation, then re-reads the history and reports the change', async () => {
      await render();
      let changes = 0;
      fixture.componentInstance.changed.subscribe(() => changes++);
      const open = vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, unknown>);

      deleteButton().click();
      tick();

      expect(open).toHaveBeenCalledWith(ConfirmDeletePmExecutionDialog, {
        data: { equipmentId: 'e1', execution: { ...HISTORY[0], notes: '' } },
      });
      httpMock.expectOne('/api/equipment/e1/maintenance-history').flush([]);
      await fixture.whenStable();
      expect(changes).toBe(1);
    });

    it('changes nothing when the deletion is not confirmed', async () => {
      await render();
      let changes = 0;
      fixture.componentInstance.changed.subscribe(() => changes++);
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(false),
      } as MatDialogRef<unknown, unknown>);

      deleteButton().click();
      await fixture.whenStable();

      expect(changes).toBe(0);
    });
  });

  it('says when nothing has been recorded yet', async () => {
    await render(undefined, (request) => request.flush([]));

    expect(history()?.querySelector('table')).toBeNull();
    expect(history()?.textContent).toContain('هنوز انجامی برای این تجهیز ثبت نشده است.');
  });

  it('offers to retry when the history cannot be read', async () => {
    await render(undefined, (request) =>
      request.flush(null, { status: 500, statusText: 'Server Error' }),
    );

    expect(history()?.querySelector('[role="alert"]')?.textContent).toContain(
      'سابقهٔ PM بارگذاری نشد.',
    );
    controlNamed(root, 'تلاش دوباره')!.click();
    tick();
    httpMock.expectOne('/api/equipment/e1/maintenance-history').flush(HISTORY);
    await fixture.whenStable();

    expect(history()?.querySelector('table')).not.toBeNull();
  });
});
