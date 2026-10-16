// Load the framework barrel first: the mapper reaches it, and the barrel's exception filter
// constructs this mapper, so entering from the mapper alone hits a load-order cycle.
import '@framework/infrastructure';

import {
  ManufacturingInstructionComponentMustHaveAtLeastOneMaterial,
  ManufacturingInstructionCompositionEntryNotFound,
  ManufacturingInstructionMiCodeAlreadyExists,
  ManufacturingInstructionMustHaveAtLeastOneComponent,
  ManufacturingInstructionProductNotFound,
} from '@manufacturing-instructions/application/exceptions';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { HttpStatus } from '@nestjs/common';

import { ManufacturingInstructionsExceptionMapper } from './exception.mapper';

// Pins the public Problem Details contract of this module's exceptions, so
// that renaming the classes behind them cannot change what a client sees.
describe('ManufacturingInstructionsExceptionMapper', () => {
  const mapper = new ManufacturingInstructionsExceptionMapper();

  it('maps a duplicate MI code to a 409 with the MI code', () => {
    const problem = mapper.toProblemDetail(
      ManufacturingInstructionMiCodeAlreadyExists.withMiCode(
        MiCode.fromString('MI-1'),
      ),
    );

    expect(problem).toMatchObject({
      typeUri: 'standard-bom-mi-code-already-exists',
      title: 'Standard BOM MI Code Already Exists',
      status: HttpStatus.CONFLICT,
      detail: 'A standard BOM already exists with MI code MI-1',
      extensionMembers: { miCode: 'MI-1' },
    });
  });

  it('maps a BOM without components to a 400', () => {
    const problem = mapper.toProblemDetail(
      ManufacturingInstructionMustHaveAtLeastOneComponent.create(),
    );

    expect(problem).toMatchObject({
      typeUri: 'standard-bom-must-have-at-least-one-component',
      title: 'Standard BOM Must Have At Least One Component',
      status: HttpStatus.BAD_REQUEST,
      detail: 'A standard BOM must have at least one component',
    });
  });

  it('maps a component without materials to a 400 with the component id', () => {
    const problem = mapper.toProblemDetail(
      ManufacturingInstructionComponentMustHaveAtLeastOneMaterial.forComponent(
        'c-1',
      ),
    );

    expect(problem).toMatchObject({
      typeUri: 'standard-bom-component-must-have-at-least-one-material',
      title: 'Standard BOM Component Must Have At Least One Material',
      status: HttpStatus.BAD_REQUEST,
      detail: 'Component c-1 must have at least one material',
      extensionMembers: { componentId: 'c-1' },
    });
  });

  it('maps an unknown product to a 400 with the product id', () => {
    const problem = mapper.toProblemDetail(
      ManufacturingInstructionProductNotFound.withId('p-1'),
    );

    expect(problem).toMatchObject({
      typeUri: 'standard-bom-product-not-found',
      title: 'Standard BOM Product Not Found',
      status: HttpStatus.BAD_REQUEST,
      detail: 'No product exists with id p-1',
      extensionMembers: { productId: 'p-1' },
    });
  });

  it('maps an unknown composition entry to a 400 with the entry id', () => {
    const problem = mapper.toProblemDetail(
      ManufacturingInstructionCompositionEntryNotFound.forMaterial('m-1'),
    );

    expect(problem).toMatchObject({
      typeUri: 'standard-bom-composition-entry-not-found',
      title: 'Standard BOM Composition Entry Not Found',
      status: HttpStatus.BAD_REQUEST,
      detail:
        "No material with id m-1 exists in the referenced component's current materials",
      extensionMembers: { entryId: 'm-1' },
    });
  });

  it('claims exactly its own five exceptions', () => {
    expect(
      mapper.canMap(
        ManufacturingInstructionMustHaveAtLeastOneComponent.create(),
      ),
    ).toBe(true);
    expect(
      mapper.canMap(
        ManufacturingInstructionMiCodeAlreadyExists.withMiCode(
          MiCode.fromString('MI-1'),
        ),
      ),
    ).toBe(true);
    expect(
      mapper.canMap(
        ManufacturingInstructionComponentMustHaveAtLeastOneMaterial.forComponent(
          'c-1',
        ),
      ),
    ).toBe(true);
    expect(
      mapper.canMap(ManufacturingInstructionProductNotFound.withId('p-1')),
    ).toBe(true);
    expect(
      mapper.canMap(
        ManufacturingInstructionCompositionEntryNotFound.forMaterial('m-1'),
      ),
    ).toBe(true);
    expect(mapper.canMap(new Error('other'))).toBe(false);
  });
});
