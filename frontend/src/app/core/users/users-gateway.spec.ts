import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UsersGateway } from './users-gateway';

describe('UsersGateway', () => {
  let gateway: UsersGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.inject(UsersGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists every registered user', () => {
    let users: unknown;
    gateway.list().subscribe((value) => (users = value));

    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush([
      { id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role: 'qc_inspector' },
      { id: '2', name: 'Yashar', username: 'yashar', role: 'system_admin' },
    ]);

    expect(users).toEqual([
      { id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role: 'qc_inspector' },
      { id: '2', name: 'Yashar', username: 'yashar', role: 'system_admin' },
    ]);
  });

  it('registers a new user', () => {
    let completed = false;
    gateway
      .register({
        name: 'Sina Ghadrdan',
        username: 'sina.q',
        password: 'Passw0rd!',
        role: 'reporter',
      })
      .subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/users' });
    expect(request.request.body).toEqual({
      name: 'Sina Ghadrdan',
      username: 'sina.q',
      password: 'Passw0rd!',
      role: 'reporter',
    });
    request.flush(null, { status: 201, statusText: 'Created' });

    expect(completed).toBe(true);
  });

  it('edits an existing user with only the given fields', () => {
    let completed = false;
    gateway.update('1', { name: 'New Name' }).subscribe(() => (completed = true));

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/users/1' });
    expect(request.request.body).toEqual({ name: 'New Name' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('deletes a user', () => {
    let completed = false;
    gateway.delete('1').subscribe(() => (completed = true));

    httpMock
      .expectOne({ method: 'DELETE', url: '/api/users/1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('fetches the signed-in user', () => {
    let me: unknown;
    gateway.me().subscribe((value) => (me = value));

    httpMock
      .expectOne({ method: 'GET', url: '/api/users/me' })
      .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role: 'qc_inspector' });

    expect(me).toEqual({
      id: '1',
      name: 'Sina Ghadrdan',
      username: 'sina.q',
      role: 'qc_inspector',
    });
  });
});
