import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import {
  ComponentNameAlreadyExists,
  ComponentNotRegistered,
  MaterialNameAlreadyExists,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';

// Maps the exceptions of all three concepts this module owns. A duplicate
// material or component name is a 409: it conflicts with existing state. Every
// product-composition case is a 400: the request's own content is at fault.
// "Name-empty" needs no case here — `RegisterProductDto`/`UpdateProductDto`
// validate nested component/material names with class-validator before the
// factory ever builds a `ComponentName`/`MaterialName` from one, so an empty
// name is an ordinary 400 validation error, not a domain exception. See
// src/modules/products/CLAUDE.md.
export class ProductsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof MaterialNameAlreadyExists ||
      exception instanceof ComponentNameAlreadyExists ||
      exception instanceof ProductMustHaveAtLeastOneComponent ||
      exception instanceof ProductComponentMustHaveAtLeastOneMaterial ||
      exception instanceof ProductCompositionEntryNotFound ||
      exception instanceof ComponentNotRegistered ||
      exception instanceof MaterialNotRegistered
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof MaterialNameAlreadyExists: {
        return new ProblemDetail(
          'material-name-already-exists',
          'Material Name Already Exists',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { name: exception.materialName.asString() },
        );
      }

      case exception instanceof ComponentNameAlreadyExists: {
        return new ProblemDetail(
          'component-name-already-exists',
          'Component Name Already Exists',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { name: exception.componentName.asString() },
        );
      }

      case exception instanceof ProductMustHaveAtLeastOneComponent: {
        return new ProblemDetail(
          'product-must-have-at-least-one-component',
          'Product Must Have At Least One Component',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof ProductComponentMustHaveAtLeastOneMaterial: {
        return new ProblemDetail(
          'product-component-must-have-at-least-one-material',
          'Product Component Must Have At Least One Material',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentName: exception.componentName },
        );
      }

      case exception instanceof ProductCompositionEntryNotFound: {
        return new ProblemDetail(
          'product-composition-entry-not-found',
          'Product Composition Entry Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { entryId: exception.entryId },
        );
      }

      case exception instanceof ComponentNotRegistered: {
        return new ProblemDetail(
          'component-not-registered',
          'Component Not Registered',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentName: exception.componentName },
        );
      }

      case exception instanceof MaterialNotRegistered: {
        return new ProblemDetail(
          'material-not-registered',
          'Material Not Registered',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { materialName: exception.materialName },
        );
      }

      default: {
        throw new RuntimeException(
          `Unexpected exception type: ${String(exception)}`,
        );
      }
    }
  }
}
