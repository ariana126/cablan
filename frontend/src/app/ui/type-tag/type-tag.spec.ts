import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { TypeTag } from './type-tag';

describe('TypeTag', () => {
  it('renders its label as plain text, with no icon: a record type is not a status', async () => {
    const fixture = TestBed.createComponent(TypeTag);
    fixture.componentRef.setInput('label', 'محصول');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent?.trim()).toBe('محصول');
    expect(root.querySelector('svg')).toBeNull();
  });
});
