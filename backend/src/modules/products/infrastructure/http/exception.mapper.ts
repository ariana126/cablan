import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';

// Maps this module's own invariants. "Name-empty" needs no case here —
// `RegisterProductDto`/`UpdateProductDto` validate nested component/material
// names with class-validator before the factory ever builds a
// `ComponentName`/`MaterialName` from one, so an empty name is an ordinary
// 400 validation error, not a domain exception. See
// src/modules/products/CLAUDE.md.
export class ProductsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof ProductMustHaveAtLeastOneComponent ||
      exception instanceof ProductComponentMustHaveAtLeastOneMaterial ||
      exception instanceof ProductCompositionEntryNotFound ||
      exception instanceof ComponentNotRegistered ||
      exception instanceof MaterialNotRegistered
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
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
