import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ActivitySpecialty } from '../../core/i18n/specialty-labels';
import { SpecialtyGroup } from './specialty-group';

@Component({
  imports: [SpecialtyGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-specialty-group [specialty]="specialty()" [level]="level()" [framed]="framed()">
      <table>
        <tbody>
          <tr>
            <td>تعویض روغن</td>
          </tr>
        </tbody>
      </table>
    </app-specialty-group>
  `,
})
class Host {
  readonly specialty = signal<ActivitySpecialty | null>('electrical');
  readonly level = signal<3 | 4>(3);
  readonly framed = signal(false);
}

async function render(specialty: ActivitySpecialty | null, level: 3 | 4 = 3) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.specialty.set(specialty);
  fixture.componentInstance.level.set(level);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const nameOf = (root: HTMLElement, section: Element | null): string =>
  root.querySelector(`#${section?.getAttribute('aria-labelledby')}`)?.textContent?.trim() ?? '';

describe('SpecialtyGroup', () => {
  it('is a region named by a heading holding exactly the specialty, around its content', async () => {
    const root = await render('electrical');

    const section = root.querySelector('section[aria-labelledby]');
    expect(nameOf(root, section)).toBe('برق');
    expect(section?.querySelector('h3')?.textContent?.trim()).toBe('برق');
    expect(section?.querySelector('table td')?.textContent?.trim()).toBe('تعویض روغن');
  });

  it('heads activities without a specialty «تخصص تعیین نشده»', async () => {
    const root = await render(null);

    expect(nameOf(root, root.querySelector('section'))).toBe('تخصص تعیین نشده');
  });

  it('takes the heading level it is nested at', async () => {
    const root = await render('mechanical', 4);

    expect(root.querySelector('h4')?.textContent?.trim()).toBe('مکانیک');
    expect(root.querySelector('h3')).toBeNull();
  });

  it('marks the specialty with an icon that adds nothing to the name', async () => {
    const root = await render('mechanical');

    expect(root.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('is a framed box only when asked, for a grid of boxes (issue #114)', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = () => (fixture.nativeElement as HTMLElement).querySelector('app-specialty-group');
    expect(host()?.classList.contains('specialty-group--framed')).toBe(false);

    fixture.componentInstance.framed.set(true);
    await fixture.whenStable();

    expect(host()?.classList.contains('specialty-group--framed')).toBe(true);
  });

  it('marks the group without a specialty, so a grid can give it a row of its own', async () => {
    const root = await render(null);

    expect(
      root.querySelector('app-specialty-group')?.classList.contains('specialty-group--unassigned'),
    ).toBe(true);
    expect(
      (await render('electrical'))
        .querySelector('app-specialty-group')
        ?.classList.contains('specialty-group--unassigned'),
    ).toBe(false);
  });
});
