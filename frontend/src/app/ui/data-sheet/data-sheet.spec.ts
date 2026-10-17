import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DataSheet } from './data-sheet';

@Component({
  imports: [DataSheet],
  template: `
    <app-data-sheet [heading]="heading" [count]="count" [loading]="loading">
      <input sheetSearch aria-label="جستجو" />
      <button sheetFilters type="button">برند</button>
      <div sheetChips>چیپ</div>
      <table>
        <tr>
          <td>سلول</td>
        </tr>
      </table>
      <div sheetFooter>پایین</div>
    </app-data-sheet>
  `,
})
class Host {
  heading = 'فهرست آنالیزها';
  count: number | null = 3;
  loading = false;
}

async function render(setUp: (host: Host) => void = () => undefined) {
  const fixture = TestBed.createComponent(Host);
  setUp(fixture.componentInstance);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('DataSheet', () => {
  it('is a region named by its heading', async () => {
    const root = await render();

    const section = root.querySelector('section');
    const heading = root.querySelector('h2');
    expect(heading?.textContent?.trim()).toBe('فهرست آنالیزها');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('gives two sheets on one page different heading ids', async () => {
    const first = TestBed.createComponent(Host);
    const second = TestBed.createComponent(Host);
    await first.whenStable();
    await second.whenStable();

    expect(first.nativeElement.querySelector('h2').id).not.toBe(
      second.nativeElement.querySelector('h2').id,
    );
  });

  it('announces the result count in Persian digits as a status', async () => {
    const root = await render();

    const status = root.querySelector('[role="status"]');
    expect(status?.textContent?.trim()).toBe('۳ نتیجه');
  });

  it('shows no count while the count is unknown', async () => {
    const root = await render((host) => (host.count = null));

    expect(root.querySelector('[role="status"]')).toBeNull();
  });

  it('shows a progress bar only while loading', async () => {
    const idle = await render();
    const busy = await render((host) => (host.loading = true));

    expect(idle.querySelector('[role="progressbar"]')).toBeNull();
    expect(busy.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('projects search, filters, chips, the table and the footer', async () => {
    const root = await render();

    expect(root.querySelector('input[aria-label="جستجو"]')).not.toBeNull();
    expect(root.textContent).toContain('برند');
    expect(root.textContent).toContain('چیپ');
    expect(root.textContent).toContain('سلول');
    expect(root.textContent).toContain('پایین');
  });

  it('keeps the table in a scrolling body so a wide table scrolls inside the frame', async () => {
    const root = await render();

    expect(root.querySelector('.data-sheet__body table')).not.toBeNull();
  });
});
