import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import {
  mapDeleteError,
  mapProductFormError,
  ProductFormModel,
  validateProductComposition,
} from './server-errors';

function problemResponse(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: '/api/products' });
}

function productForm(model: ProductFormModel) {
  return TestBed.runInInjectionContext(() => form(signal<ProductFormModel>(model)));
}

const oneValidComponent = [{ name: 'پیچ شش‌گوش', materials: [{ name: 'میلگرد فولادی' }] }];

describe('validateProductComposition', () => {
  it('is satisfied when every component has at least one material', () => {
    expect(
      validateProductComposition({ name: 'ویجت', components: oneValidComponent }),
    ).toBeUndefined();
  });

  it('reports a product with no components', () => {
    expect(validateProductComposition({ name: 'ویجت', components: [] })).toEqual({
      kind: 'noComponents',
      message: 'هر محصول باید حداقل یک جز داشته باشد.',
    });
  });

  it('reports the first component with no materials', () => {
    const result = validateProductComposition({
      name: 'ویجت',
      components: [{ name: 'پیچ شش‌گوش', materials: [] }],
    });

    expect(result?.kind).toBe('noMaterials');
    expect(result?.message).toContain('پیچ شش‌گوش');
  });
});

describe('mapProductFormError', () => {
  it('attaches a validation-error on the product name to the name field', () => {
    const formTree = productForm({ name: '', components: [] });

    const errors = mapProductFormError(
      problemResponse(400, {
        type: PROBLEM.validationError,
        errors: [{ field: 'name', message: 'name should not be empty' }],
      }),
      formTree,
    );

    expect(errors).toEqual([
      { fieldTree: formTree.name, kind: 'server', message: 'نام نمی‌تواند خالی باشد.' },
    ]);
  });

  it('reports the at-least-one-component invariant on the form root', () => {
    const formTree = productForm({ name: 'ویجت', components: [] });

    const errors = mapProductFormError(
      problemResponse(400, { type: PROBLEM.productMustHaveAtLeastOneComponent }),
      formTree,
    );

    expect(errors).toEqual([{ kind: 'server', message: 'هر محصول باید حداقل یک جز داشته باشد.' }]);
  });

  it('reports the at-least-one-material invariant on the form root', () => {
    const formTree = productForm({
      name: 'ویجت',
      components: [{ name: 'پیچ شش‌گوش', materials: [] }],
    });

    const errors = mapProductFormError(
      problemResponse(400, {
        type: PROBLEM.productComponentMustHaveAtLeastOneMaterial,
        componentName: 'پیچ شش‌گوش',
      }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'هر جز باید حداقل یک مواد اولیه داشته باشد.' },
    ]);
  });

  it('targets the colliding component name field when it can find a match', () => {
    const formTree = productForm({
      name: 'ویجت',
      components: [{ name: 'پیچ شش‌گوش', materials: [{ name: 'میلگرد فولادی' }] }],
    });

    const errors = mapProductFormError(
      problemResponse(409, {
        type: PROBLEM.componentNameAlreadyExists,
        name: 'پیچ شش‌گوش',
      }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.components[0].name,
        kind: 'server',
        message: 'این نام قبلاً برای جز دیگری ثبت شده است.',
      },
    ]);
  });

  it('falls back to the form root for a component-name conflict it cannot locate', () => {
    const formTree = productForm({ name: 'ویجت', components: oneValidComponent });

    const errors = mapProductFormError(
      problemResponse(409, { type: PROBLEM.componentNameAlreadyExists, name: 'نام دیگر' }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این نام قبلاً برای جز دیگری ثبت شده است.' },
    ]);
  });

  it('targets the colliding material name field when it can find a match', () => {
    const formTree = productForm({
      name: 'ویجت',
      components: [{ name: 'پیچ شش‌گوش', materials: [{ name: 'میلگرد فولادی' }] }],
    });

    const errors = mapProductFormError(
      problemResponse(409, {
        type: PROBLEM.materialNameAlreadyExists,
        name: 'میلگرد فولادی',
      }),
      formTree,
    );

    expect(errors).toEqual([
      {
        fieldTree: formTree.components[0].materials[0].name,
        kind: 'server',
        message: 'این نام قبلاً برای مواد اولیهٔ دیگری ثبت شده است.',
      },
    ]);
  });

  it('reports a since-deleted product on the form root', () => {
    const formTree = productForm({ name: 'ویجت', components: oneValidComponent });

    const errors = mapProductFormError(
      problemResponse(404, { type: PROBLEM.entityNotFound }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'این محصول دیگر وجود ندارد. فهرست را تازه‌سازی کنید.' },
    ]);
  });

  it('reports a 403 as an access-denied message on the form root, whatever the body carries', () => {
    const formTree = productForm({ name: 'ویجت', components: oneValidComponent });

    const errors = mapProductFormError(problemResponse(403, { title: 'Forbidden' }), formTree);

    expect(errors).toEqual([{ kind: 'server', message: 'شما اجازهٔ انجام این عملیات را ندارید.' }]);
  });

  it('falls back to a root message for a network failure or anything unrecognised', () => {
    const formTree = productForm({ name: 'ویجت', components: oneValidComponent });

    const errors = mapProductFormError(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error'), url: '/api/products' }),
      formTree,
    );

    expect(errors).toEqual([
      { kind: 'server', message: 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.' },
    ]);
  });
});

describe('mapDeleteError', () => {
  it('reports an access-denied message for a 403, regardless of body', () => {
    expect(mapDeleteError(problemResponse(403, { title: 'Forbidden' }))).toBe(
      'شما اجازهٔ انجام این عملیات را ندارید.',
    );
  });

  it('reports an already-deleted message for a 404', () => {
    expect(mapDeleteError(problemResponse(404, { type: PROBLEM.entityNotFound }))).toBe(
      'این محصول پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(
      mapDeleteError(
        new HttpErrorResponse({
          status: 0,
          error: new ProgressEvent('error'),
          url: '/api/products/1',
        }),
      ),
    ).toBe('حذف محصول ممکن نشد. دوباره تلاش کنید.');
  });
});
