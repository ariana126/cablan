// Loaded first, for its side effect: the framework barrel pulls in
// `HttpExceptionFilter`, which instantiates every module's mapper. Entering that
// cycle from the mapper under test instead leaves `ProductsExceptionMapper`
// still undefined when the filter reaches it.
import '@framework/infrastructure';

import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import {
  ComponentNameAlreadyExists,
  ComponentNotRegistered,
  MaterialCodeAlreadyExists,
  MaterialNameAlreadyExists,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { ProductsExceptionMapper } from './exception.mapper';

// Pins the public Problem Details contract of every exception that materials,
// components and products map. It was written against the three separate
// mappers before they were merged, and its assertions have not changed since.
// `HttpExceptionFilter` asks the mappers in turn, so each exception must be
// claimed by exactly one of them.
const mappers: ExceptionMapper[] = [new ProductsExceptionMapper()];

function problemFor(exception: unknown): ProblemDetail {
  const claiming = mappers.filter((mapper) => mapper.canMap(exception));
  if (claiming.length !== 1) {
    throw new Error(
      `Expected exactly one mapper to claim ${String(exception)}, got ${claiming.length}`,
    );
  }
  return claiming[0].toProblemDetail(exception);
}

describe('Problem Details for materials, components and products', () => {
  it('maps a duplicate material name to a 409 carrying the name', () => {
    const problem = problemFor(
      MaterialNameAlreadyExists.withName(MaterialName.fromString('Steel Rod')),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'material-name-already-exists',
      title: 'Material Name Already Exists',
      status: HttpStatus.CONFLICT,
      detail: 'A material already exists with name Steel Rod',
      instance: undefined,
      extensionMembers: { name: 'Steel Rod' },
    });
  });

  it('maps a duplicate material code to a 409 carrying the code', () => {
    const problem = problemFor(
      MaterialCodeAlreadyExists.withCode(MaterialCode.fromString('RM-001')),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'material-code-already-exists',
      title: 'Material Code Already Exists',
      status: HttpStatus.CONFLICT,
      detail: 'A material already exists with code RM-001',
      instance: undefined,
      extensionMembers: { code: 'RM-001' },
    });
  });

  it('maps a duplicate component name to a 409 carrying the name', () => {
    const problem = problemFor(
      ComponentNameAlreadyExists.withName(ComponentName.fromString('Bolt')),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'component-name-already-exists',
      title: 'Component Name Already Exists',
      status: HttpStatus.CONFLICT,
      detail: 'A component already exists with name Bolt',
      instance: undefined,
      extensionMembers: { name: 'Bolt' },
    });
  });

  it('maps a product without components to a 400 with no extension members', () => {
    const problem = problemFor(ProductMustHaveAtLeastOneComponent.create());

    expect({ ...problem }).toStrictEqual({
      typeUri: 'product-must-have-at-least-one-component',
      title: 'Product Must Have At Least One Component',
      status: HttpStatus.BAD_REQUEST,
      detail: 'A product must have at least one component',
      instance: undefined,
      extensionMembers: undefined,
    });
  });

  it('maps a component without materials to a 400 carrying the component name', () => {
    const problem = problemFor(
      ProductComponentMustHaveAtLeastOneMaterial.forComponent('Bolt'),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'product-component-must-have-at-least-one-material',
      title: 'Product Component Must Have At Least One Material',
      status: HttpStatus.BAD_REQUEST,
      detail: 'Component Bolt must have at least one material',
      instance: undefined,
      extensionMembers: { componentName: 'Bolt' },
    });
  });

  it('maps an unknown component entry to a 400 carrying the entry id', () => {
    const problem = problemFor(
      ProductCompositionEntryNotFound.forComponent('c-1'),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'product-composition-entry-not-found',
      title: 'Product Composition Entry Not Found',
      status: HttpStatus.BAD_REQUEST,
      detail:
        "No component with id c-1 exists in this product's current composition",
      instance: undefined,
      extensionMembers: { entryId: 'c-1' },
    });
  });

  it('maps an unknown material entry to a 400 carrying the entry id', () => {
    const problem = problemFor(
      ProductCompositionEntryNotFound.forMaterial('m-1'),
    );

    expect({ ...problem }).toStrictEqual({
      typeUri: 'product-composition-entry-not-found',
      title: 'Product Composition Entry Not Found',
      status: HttpStatus.BAD_REQUEST,
      detail:
        "No material with id m-1 exists in this product's current composition",
      instance: undefined,
      extensionMembers: { entryId: 'm-1' },
    });
  });

  it('maps an unregistered component name to a 400 carrying the name', () => {
    const problem = problemFor(ComponentNotRegistered.withName('Bolt'));

    expect({ ...problem }).toStrictEqual({
      typeUri: 'component-not-registered',
      title: 'Component Not Registered',
      status: HttpStatus.BAD_REQUEST,
      detail: 'No component named "Bolt" is registered',
      instance: undefined,
      extensionMembers: { componentName: 'Bolt' },
    });
  });

  it('maps an unregistered material name to a 400 carrying the name', () => {
    const problem = problemFor(MaterialNotRegistered.withName('Steel Rod'));

    expect({ ...problem }).toStrictEqual({
      typeUri: 'material-not-registered',
      title: 'Material Not Registered',
      status: HttpStatus.BAD_REQUEST,
      detail: 'No material named "Steel Rod" is registered',
      instance: undefined,
      extensionMembers: { materialName: 'Steel Rod' },
    });
  });

  it('leaves an unrelated error to the other mappers', () => {
    expect(mappers.some((mapper) => mapper.canMap(new Error('other')))).toBe(
      false,
    );
  });
});
