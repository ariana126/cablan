import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './page-header';

@Component({
  imports: [PageHeader],
  template: `
    <app-page-header [heading]="heading" [description]="description">
      <button pageHeaderActions type="button">افزودن</button>
    </app-page-header>
  `,
})
class Host {
  heading = 'آنالیز های روزانه';
  description: string | undefined = undefined;
}

async function render(description?: string): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.description = description;
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('PageHeader', () => {
  it('renders the page title as the one level-one heading', async () => {
    const root = await render();

    const headings = root.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.trim()).toBe('آنالیز های روزانه');
  });

  it('renders no description line when none is given', async () => {
    const root = await render();

    expect(root.querySelector('p')).toBeNull();
  });

  it('renders the description under the title when given', async () => {
    const root = await render('ثبت و بررسی وزن مواد اولیه');

    expect(root.querySelector('p')?.textContent?.trim()).toBe('ثبت و بررسی وزن مواد اولیه');
  });

  it('projects the page actions', async () => {
    const root = await render();

    expect(root.querySelector('button')?.textContent?.trim()).toBe('افزودن');
  });
});
