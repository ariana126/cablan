import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import {
  ComponentNameAlreadyExists,
  ComponentNotRegistered,
  MaterialCodeAlreadyExists,
  MaterialImportEmpty,
  MaterialImportFileUnreadable,
  MaterialImportHasInvalidRows,
  MaterialImportNotFound,
  MaterialNameAlreadyExists,
  MaterialNotRegistered,
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductCompositionEntryNotFound,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';
import { MaterialImportAlreadyReverted } from '@products/domain/exceptions/material-import-already-reverted.exception';
import { MaterialImportNotLatest } from '@products/domain/exceptions/material-import-not-latest.exception';
import { MaterialImportNotRevertible } from '@products/domain/exceptions/material-import-not-revertible.exception';

// Maps the exceptions of all three concepts this module owns. A duplicate
// material name or code, or a duplicate component name, is a 409: it conflicts with existing state. Every
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
      exception instanceof MaterialCodeAlreadyExists ||
      exception instanceof ComponentNameAlreadyExists ||
      exception instanceof ProductMustHaveAtLeastOneComponent ||
      exception instanceof ProductComponentMustHaveAtLeastOneMaterial ||
      exception instanceof ProductCompositionEntryNotFound ||
      exception instanceof ComponentNotRegistered ||
      exception instanceof MaterialNotRegistered ||
      exception instanceof MaterialImportFileUnreadable ||
      exception instanceof MaterialImportHasInvalidRows ||
      exception instanceof MaterialImportEmpty ||
      exception instanceof MaterialImportNotFound ||
      exception instanceof MaterialImportNotLatest ||
      exception instanceof MaterialImportAlreadyReverted ||
      exception instanceof MaterialImportNotRevertible
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

      case exception instanceof MaterialCodeAlreadyExists: {
        return new ProblemDetail(
          'material-code-already-exists',
          'Material Code Already Exists',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { code: exception.materialCode.asString() },
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

      // Importing materials (issue #74). A file or kept rows that can't be
      // applied are the request's own fault: 400s. Reverting conflicts with
      // later state — a later import, an earlier reversion, materials that
      // changed since: 409s.
      case exception instanceof MaterialImportFileUnreadable: {
        return new ProblemDetail(
          'material-import-file-unreadable',
          'Material Import File Unreadable',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof MaterialImportHasInvalidRows: {
        return new ProblemDetail(
          'material-import-has-invalid-rows',
          'Material Import Has Invalid Rows',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { rows: exception.rows },
        );
      }

      case exception instanceof MaterialImportEmpty: {
        return new ProblemDetail(
          'material-import-empty',
          'Material Import Empty',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof MaterialImportNotFound: {
        return new ProblemDetail(
          'material-import-not-found',
          'Material Import Not Found',
          HttpStatus.NOT_FOUND,
          exception.message,
          undefined,
          { importId: exception.importId },
        );
      }

      case exception instanceof MaterialImportNotLatest: {
        return new ProblemDetail(
          'material-import-not-latest',
          'Material Import Not Latest',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { importId: exception.importId },
        );
      }

      case exception instanceof MaterialImportAlreadyReverted: {
        return new ProblemDetail(
          'material-import-already-reverted',
          'Material Import Already Reverted',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { importId: exception.importId },
        );
      }

      case exception instanceof MaterialImportNotRevertible: {
        return new ProblemDetail(
          'material-import-not-revertible',
          'Material Import Not Revertible',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { importId: exception.importId, reason: exception.reason },
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
