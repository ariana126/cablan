import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { HomePage } from './home-page';

describe('HomePage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).store('a-valid-token');
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Renders the page for a signed-in user of the given role. */
  async function renderPageFor(role: Role): Promise<HTMLElement> {
    const pending = TestBed.inject(CurrentUserStore).load();
    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
    await pending;

    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  function linkedPaths(page: HTMLElement): string[] {
    return [...page.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
  }

  it('greets the signed-in user by name', async () => {
    const page = await renderPageFor(Role.system_admin);

    expect(page.querySelector('h1')?.textContent).toContain('Sina Ghadrdan');
  });

  it('links every section a System Admin may reach', async () => {
    const paths = linkedPaths(await renderPageFor(Role.system_admin));

    expect(paths).toContain('/users');
    expect(paths).toContain('/audit-log');
    expect(paths).toContain('/boms/dashboard');
  });

  it('withholds the sections a Reporter may not reach', async () => {
    const paths = linkedPaths(await renderPageFor(Role.reporter));

    expect(paths).not.toContain('/users');
    expect(paths).not.toContain('/audit-log');
    expect(paths).not.toContain('/boms/dashboard');
    expect(paths).toContain('/boms');
    expect(paths).toContain('/standard-boms');
  });

  // Home links onward, never back to itself — a card to the page you are already on is noise.
  it('does not link to itself', async () => {
    expect(linkedPaths(await renderPageFor(Role.system_admin))).not.toContain('/');
  });
});
