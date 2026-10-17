import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ErrorBanner } from './error-banner';

async function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(ErrorBanner);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('ErrorBanner', () => {
  it('is announced as an alert and says what failed', async () => {
    const { root } = await render({ message: 'فهرست بارگذاری نشد.' });

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('فهرست بارگذاری نشد.');
  });

  it('shows the cause under the message only when there is one', async () => {
    const without = await render({ message: 'فهرست بارگذاری نشد.' });
    const withDetail = await render({
      message: 'فهرست بارگذاری نشد.',
      detail: 'خطایی در برقراری ارتباط با سرور رخ داد.',
    });

    expect(without.root.textContent).not.toContain('سرور');
    expect(withDetail.root.textContent).toContain('خطایی در برقراری ارتباط با سرور رخ داد.');
  });

  it('offers a retry button only when given a label, and emits retry', async () => {
    const without = await render({ message: 'خطا.' });
    const { fixture, root } = await render({ message: 'خطا.', retryLabel: 'تلاش دوباره' });
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);

    root.querySelector('button')!.click();

    expect(without.root.querySelector('button')).toBeNull();
    expect(root.querySelector('button')?.textContent?.trim()).toBe('تلاش دوباره');
    expect(retries).toBe(1);
  });
});
