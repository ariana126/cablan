import { ApproveBomCommand } from '@boms/application/commands/approve-bom/approve-bom.command';
import { DeleteBomCommand } from '@boms/application/commands/delete-bom/delete-bom.command';
import { EditBomCommand } from '@boms/application/commands/edit-bom/edit-bom.command';
import { RegisterBomCommand } from '@boms/application/commands/register-bom/register-bom.command';
import { RejectBomCommand } from '@boms/application/commands/reject-bom/reject-bom.command';
import { ResampleBomCommand } from '@boms/application/commands/resample-bom/resample-bom.command';
import { BomFilterOptionsQuery } from '@boms/application/queries/bom-filter-options/bom-filter-options.query';
import { BomFilterOptions } from '@boms/application/queries/bom-filter-options/bom-filter-options.read-model';
import { BomExportResult } from '@boms/application/queries/export-boms/bom-export.read-model';
import { ExportBomsQuery } from '@boms/application/queries/export-boms/export-boms.query';
import { BomDetail } from '@boms/application/queries/get-bom/bom-detail.read-model';
import { GetBomQuery } from '@boms/application/queries/get-bom/get-bom.query';
import { BomWeightDifferences } from '@boms/application/queries/get-bom-weight-differences/bom-weight-differences.read-model';
import { GetBomWeightDifferencesQuery } from '@boms/application/queries/get-bom-weight-differences/get-bom-weight-differences.query';
import { BomReadModel } from '@boms/application/queries/list-boms/bom.read-model';
import { ListBomsQuery } from '@boms/application/queries/list-boms/list-boms.query';
import { BomReportPage } from '@boms/application/queries/report-boms/bom-report.read-model';
import { ReportBomsQuery } from '@boms/application/queries/report-boms/report-boms.query';
import { BomReportFilters } from '@boms/application/service/bom-report.repository';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomEditSource } from '@boms/domain/value/bom-edit-source';
import { BOM_REVIEWER_ROLES } from '@boms/domain/value/bom-reviewers';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import {
  BomEditRecordSchema,
  EditHistoryProperty,
} from '@boms/infrastructure/http/bom-edit-record.schema';
import { MaterialWeightDifferenceSchema } from '@boms/infrastructure/http/material-weight-difference.schema';
import {
  BOM_EXPORT_FILE_NAME,
  bomExportWorkbookOptions,
  buildBomExportGrid,
} from '@boms/infrastructure/spreadsheet/bom-export-grid';
import {
  DisplayNameProvider,
  Identity,
  PRODUCTION_ROLES,
  Role,
  UserRoleProvider,
} from '@framework/domain';
import {
  AuthenticatedUser,
  CurrentUser,
  domainErrorSchema,
  EntityNotFoundSchema,
  JwtAuthGuard,
  JwtUnauthorizedSchema,
  renderXlsxWorkbook,
  Roles,
  RolesGuard,
  ValidationErrorSchema,
  xlsxAttachment,
  xlsxDownloadResponse,
} from '@framework/infrastructure';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ExportBomsDto } from './dto/export-boms.dto';
import { RegisterBomDto } from './dto/register-bom.dto';
import { RejectBomDto } from './dto/reject-bom.dto';
import { BomReportFiltersDto, ReportBomsDto } from './dto/report-boms.dto';
import { ResampleBomDto } from './dto/resample-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

const BomCompositionSchema = {
  type: 'array',
  items: {
    properties: {
      id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
      name: { type: 'string', example: 'Bolt' },
      materials: {
        type: 'array',
        items: {
          properties: {
            id: {
              type: 'string',
              example: '550e8400-e29b-41d4-a716-446655440002',
            },
            name: { type: 'string', example: 'Steel Rod' },
            weight: { type: 'number', example: 150 },
          },
        },
      },
    },
  },
} as const;

const BomSchema = {
  properties: {
    id: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440003',
    },
    standardBomId: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
    orderNumber: { type: 'string', example: 'SO-1234' },
    trackingNumber: { type: 'string', example: 'TN-5678' },
    description: { type: 'string', example: 'Daily BOM for order SO-1234' },
    components: BomCompositionSchema,
  },
} as const;

// A plain (mutable) array: Swagger's `enum` rejects the readonly tuple an
// `as const` literal would make of it.
const APPROVAL_STATUS_VALUES: ApprovalStatus[] = Object.values(ApprovalStatus);

const ApprovalProperties = {
  approvalStatus: {
    type: 'string',
    enum: APPROVAL_STATUS_VALUES,
    example: 'approved',
  },
  reviewedBy: {
    type: 'string',
    nullable: true,
    example: 'مصطفی',
    description:
      'The display name of whoever approved or rejected the BOM; null while pending',
  },
  managementNote: {
    type: 'string',
    nullable: true,
    example: 'وزن جز مغزی مواد اولیه مسی از 3 به 2 تغییر کرد',
    description:
      "The review's management note («توضیحات مدیریت»): a rejection's reason, or on approval the review edits (a reviewer's edits from the dashboard) of that review, one block each — its heading line, then its change lines — all joined by newlines. Null while pending, and on an approval with no review edits",
  },
} as const;

const ResamplableProperty = {
  resamplable: {
    type: 'boolean',
    example: false,
    description:
      'Whether the daily BOM can be re-sampled («نمونه گیری مجدد», POST /boms/{id}/resampling): it is rejected and no other daily BOM with its tracking number was registered after it',
  },
} as const;

const BomReportItemSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440003' },
    orderNumber: { type: 'string', example: 'ORD-2001' },
    trackingNumber: { type: 'string', example: 'TRK-3001' },
    registeredAt: { type: 'string', example: '2026-06-22T04:00:00.000Z' },
    registeredBy: { type: 'string', example: 'نیکروش' },
    standardBomMiCode: { type: 'string', example: '1001' },
    brand: { type: 'string', example: 'لگراند' },
    productName: {
      type: 'string',
      example: 'کابل شبکه U/UTP 0.42 LEGRAND',
    },
    ...ApprovalProperties,
    ...EditHistoryProperty,
    ...ResamplableProperty,
  },
} as const;

const BomReportPageSchema = {
  properties: {
    items: { type: 'array', items: BomReportItemSchema },
    total: { type: 'number', example: 4 },
  },
} as const;

const BomFilterOptionsSchema = {
  properties: {
    orderNumbers: {
      type: 'array',
      items: { type: 'string' },
      example: ['ORD-2001'],
      description: 'Distinct order numbers, sorted',
    },
    trackingNumbers: {
      type: 'array',
      items: { type: 'string' },
      example: ['TRK-3001'],
      description: 'Distinct tracking numbers, sorted',
    },
    brands: { type: 'array', items: { type: 'string' }, example: ['لگراند'] },
    componentNames: {
      type: 'array',
      items: { type: 'string' },
      example: ['مغزی'],
    },
    standardBomMiCodes: {
      type: 'array',
      items: { type: 'string' },
      example: ['1001'],
    },
    productNames: {
      type: 'array',
      items: { type: 'string' },
      example: ['کابل شبکه U/UTP 0.42 LEGRAND'],
    },
    registeredByUsers: {
      type: 'array',
      items: { type: 'string' },
      example: ['نیکروش'],
    },
    approvalStatuses: {
      type: 'array',
      items: { type: 'string', enum: APPROVAL_STATUS_VALUES },
      example: ['approved', 'pending', 'rejected'],
    },
    reviewers: {
      type: 'array',
      items: { type: 'string' },
      example: ['مصطفی'],
      description:
        'Distinct reviewer display names (approvals and rejections alike), sorted; never null',
    },
  },
} as const;

const BomDetailSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440003' },
    standardBomId: {
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
    standardBomMiCode: { type: 'string', example: '1001' },
    brand: { type: 'string', example: 'لگراند' },
    productName: {
      type: 'string',
      example: 'کابل شبکه U/UTP 0.42 LEGRAND',
    },
    standardLength: { type: 'number', example: 305 },
    orderNumber: { type: 'string', example: 'ORD-2001' },
    trackingNumber: { type: 'string', example: 'TRK-3001' },
    registeredBy: { type: 'string', example: 'نیکروش' },
    registeredAt: { type: 'string', example: '2026-06-22T04:00:00.000Z' },
    description: { type: 'string', example: 'بررسی کیفیت اولیه' },
    components: BomCompositionSchema,
    totalWeight: { type: 'number', example: 23 },
    ...ApprovalProperties,
    ...EditHistoryProperty,
    ...ResamplableProperty,
  },
} as const;

const BomWeightDifferencesSchema = {
  properties: {
    lines: { type: 'array', items: MaterialWeightDifferenceSchema },
  },
} as const;

const BomMustHaveAtLeastOneComponentResponse = {
  schema: domainErrorSchema(
    'bom-must-have-at-least-one-component',
    'BOM Must Have At Least One Component',
    400,
    'A BOM must have at least one component',
  ),
};

const BomComponentMustHaveAtLeastOneMaterialResponse = {
  schema: domainErrorSchema(
    'bom-component-must-have-at-least-one-material',
    'BOM Component Must Have At Least One Material',
    400,
    'Component 550e8400-e29b-41d4-a716-446655440001 must have at least one material',
    {
      componentId: {
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  ),
};

// Thrown while registering or editing: the given `standardBomMiCode` doesn't
// resolve to an existing standard BOM. See `BomCompositionFactory` and
// src/modules/boms/CLAUDE.md.
const BomStandardBomNotFoundResponse = {
  schema: domainErrorSchema(
    'bom-standard-bom-not-found',
    'BOM Standard BOM Not Found',
    400,
    'No standard BOM exists with MI code 0001',
    {
      standardBomMiCode: { type: 'string', example: '0001' },
    },
  ),
};

// Thrown while registering or editing: a requested (componentId, materialId)
// pair isn't part of the referenced standard BOM's *current* composition.
const BomCompositionEntryNotFoundResponse = {
  schema: domainErrorSchema(
    'bom-composition-entry-not-found',
    'BOM Composition Entry Not Found',
    400,
    "No component with id 550e8400-e29b-41d4-a716-446655440001 exists in the referenced standard BOM's current composition",
    {
      entryId: {
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  ),
};

const BomAlreadyReviewedResponse = {
  schema: domainErrorSchema(
    'bom-already-reviewed',
    'BOM Already Reviewed',
    409,
    'Daily BOM 550e8400-e29b-41d4-a716-446655440003 is already approved; edit it to send it back to pending before reviewing it again',
    {
      approvalStatus: {
        type: 'string',
        example: 'approved',
      },
    },
  ),
};

const BomNotResamplableResponse = {
  schema: domainErrorSchema(
    'bom-not-resamplable',
    'BOM Not Resamplable',
    409,
    'Daily BOM 550e8400-e29b-41d4-a716-446655440003 cannot be re-sampled: another daily BOM of its tracking number was registered after it',
    {
      approvalStatus: { type: 'string', example: 'rejected' },
      // 'not-rejected' | 'not-latest' (not the latest daily BOM of its
      // tracking number); `domainErrorSchema` members carry no enum.
      reason: { type: 'string', example: 'not-latest' },
    },
  ),
};

const ResampledBomSchema = {
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440004' },
  },
} as const;

const RejectionReasonRequiredResponse = {
  schema: domainErrorSchema(
    'rejection-reason-required',
    'Rejection Reason Required',
    400,
    'A daily BOM cannot be rejected without a reason',
  ),
};

const EditReasonRequiredResponse = {
  schema: domainErrorSchema(
    'edit-reason-required',
    'Edit Reason Required',
    400,
    'A daily BOM cannot be edited without a reason',
  ),
};

const ApprovalForbiddenResponse = {
  description: 'Not a Management or System Admin user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

const ForbiddenResponse = {
  description: 'Not a QC Inspector, Management or System Admin user',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

@ApiTags('BOMs')
@ApiBearerAuth()
@ApiExtraModels(BomEditRecordSchema)
@Controller('boms')
export class BomController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly displayNameProvider: DisplayNameProvider,
    private readonly userRoleProvider: UserRoleProvider,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.QcInspector, Role.Management, Role.SystemAdmin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Register a new daily BOM, cloning the referenced standard BOM's current composition",
  })
  @ApiCreatedResponse({
    description: 'BOM registered successfully',
    schema: BomSchema,
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(BomMustHaveAtLeastOneComponentResponse)
  @ApiBadRequestResponse(BomComponentMustHaveAtLeastOneMaterialResponse)
  @ApiBadRequestResponse(BomStandardBomNotFoundResponse)
  @ApiBadRequestResponse(BomCompositionEntryNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  async register(
    @Body() body: RegisterBomDto,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<BomReadModel> {
    const registeredBy = await this.displayNameProvider.getName(actingUser.id);
    return this.commandBus.execute(
      new RegisterBomCommand(
        body.standardBomMiCode,
        OrderNumber.fromString(body.orderNumber),
        TrackingNumber.fromString(body.trackingNumber),
        body.description,
        body.components,
        registeredBy,
      ),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.QcInspector, Role.Management, Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Edit an existing daily BOM's fields and/or composition, replacing its components wholesale, for a stated reason",
    description:
      "An edit that changes something needs a reason (`editReason`) and is recorded with it: a reviewer's edit from the dashboard (`editSource: 'dashboard'`) as a block of the management note the next approval records, every other edit as a record of the BOM's `editHistory`. A save that changes nothing needs no reason and records nothing.",
  })
  @ApiNoContentResponse({ description: 'BOM updated successfully' })
  @ApiBadRequestResponse(EditReasonRequiredResponse)
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(BomMustHaveAtLeastOneComponentResponse)
  @ApiBadRequestResponse(BomComponentMustHaveAtLeastOneMaterialResponse)
  @ApiBadRequestResponse(BomStandardBomNotFoundResponse)
  @ApiBadRequestResponse(BomCompositionEntryNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBomDto,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<void> {
    // Whether the editor may review — with where they edited from — decides
    // whether this is a review edit, noted when the BOM is approved, or a
    // correction. Read the same way `RolesGuard` authorises the review
    // endpoints below: the user's current role, never a token claim. Who
    // they are is cloned onto the edit's record as their display name, like
    // `registeredBy`.
    const editorRole = await this.userRoleProvider.getRole(actingUser.id);
    const editedBy = await this.displayNameProvider.getName(actingUser.id);
    await this.commandBus.execute(
      new EditBomCommand(
        Identity.fromString(id),
        editorRole,
        editedBy,
        body.editSource ?? BomEditSource.DailyBoms,
        body.editReason,
        body.orderNumber === undefined
          ? undefined
          : OrderNumber.fromString(body.orderNumber),
        body.trackingNumber === undefined
          ? undefined
          : TrackingNumber.fromString(body.trackingNumber),
        body.description,
        body.components,
        body.standardBomMiCode,
      ),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.QcInspector, Role.Management, Role.SystemAdmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a daily BOM' })
  @ApiNoContentResponse({ description: 'BOM deleted successfully' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async delete(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteBomCommand(Identity.fromString(id)),
    );
  }

  // Reviewing — approving or rejecting — is for `BOM_REVIEWER_ROLES` alone
  // (Management and System Admin): a QC Inspector registers and edits daily
  // BOMs but never vouches for them. Only a pending BOM can be reviewed; an
  // approved or rejected one is a 409 until an edit sends it back to pending.
  @Post(':id/approval')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...BOM_REVIEWER_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Approve a pending daily BOM as the current user, noting the edits by any reviewer during the review as its management note',
  })
  @ApiNoContentResponse({ description: 'BOM approved' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ApprovalForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(BomAlreadyReviewedResponse)
  async approve(
    @Param('id') id: string,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<void> {
    const reviewerName = await this.displayNameProvider.getName(actingUser.id);
    await this.commandBus.execute(
      new ApproveBomCommand(Identity.fromString(id), reviewerName),
    );
  }

  @Post(':id/rejection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...BOM_REVIEWER_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Reject a pending daily BOM as the current user, with the given reason as its management note',
  })
  @ApiNoContentResponse({ description: 'BOM rejected' })
  @ApiBadRequestResponse(RejectionReasonRequiredResponse)
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ApprovalForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(BomAlreadyReviewedResponse)
  async reject(
    @Param('id') id: string,
    @Body() body: RejectBomDto,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<void> {
    const reviewerName = await this.displayNameProvider.getName(actingUser.id);
    await this.commandBus.execute(
      new RejectBomCommand(Identity.fromString(id), reviewerName, body.reason),
    );
  }

  // Re-sampling («نمونه گیری مجدد»): registering a new daily BOM for a
  // rejected one's work order — its order number, tracking number and MI code
  // taken from it, the weights and description from the body. Whoever may
  // register may re-sample. Only the latest daily BOM of a tracking number,
  // once rejected, can be (409 otherwise); it is left as it was.
  @Post(':id/resampling')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.QcInspector, Role.Management, Role.SystemAdmin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Re-sample a rejected daily BOM: register a new, pending daily BOM with its order number, tracking number and MI code, the given weights cloned onto its standard BOM's current composition, and the given description",
  })
  @ApiCreatedResponse({
    description: 'The new daily BOM, registered',
    schema: ResampledBomSchema,
  })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiBadRequestResponse(BomMustHaveAtLeastOneComponentResponse)
  @ApiBadRequestResponse(BomComponentMustHaveAtLeastOneMaterialResponse)
  @ApiBadRequestResponse(BomStandardBomNotFoundResponse)
  @ApiBadRequestResponse(BomCompositionEntryNotFoundResponse)
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiForbiddenResponse(ForbiddenResponse)
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  @ApiConflictResponse(BomNotResamplableResponse)
  async resample(
    @Param('id') id: string,
    @Body() body: ResampleBomDto,
    @CurrentUser() actingUser: AuthenticatedUser,
  ): Promise<{ id: string }> {
    const registeredBy = await this.displayNameProvider.getName(actingUser.id);
    const resampledId: Identity = await this.commandBus.execute(
      new ResampleBomCommand(
        Identity.fromString(id),
        body.components,
        body.description,
        registeredBy,
      ),
    );
    return { id: resampledId.asString() };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @ApiOperation({ summary: 'List every registered daily BOM' })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiOkResponse({
    schema: { type: 'array', items: BomSchema },
  })
  async list(): Promise<BomReadModel[]> {
    return this.queryBus.execute(new ListBomsQuery());
  }

  // No `@Roles()` here, deliberately, on this and the two endpoints below:
  // this report is exactly what the "گزارشگیر" (Reporter) role — excluded
  // from every write endpoint above — exists to read. See
  // src/modules/boms/CLAUDE.md.
  @Post('report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Search daily BOMs with pagination and Excel-style filters, newest-registered first',
  })
  @ApiOkResponse({ schema: BomReportPageSchema })
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async report(@Body() body: ReportBomsDto): Promise<BomReportPage> {
    return this.queryBus.execute(
      new ReportBomsQuery(
        body.page,
        body.pageSize,
        toReportFilters(body.filters),
      ),
    );
  }

  // No `@Roles()` here either, for the same reason as `report()` above: this
  // is "خروجی اکسل آنالیز های روزانه", the Reporter's download. The query
  // returns the export set; shaping it into rows and writing the workbook is
  // presentation, so it happens here. See src/modules/boms/CLAUDE.md.
  @Post('report/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Export every daily BOM matching the given filters, unpaginated, as an .xlsx workbook in the chosen row layout',
  })
  @ApiOkResponse(xlsxDownloadResponse(BOM_EXPORT_FILE_NAME))
  @ApiBadRequestResponse({ schema: ValidationErrorSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async export(@Body() body: ExportBomsDto): Promise<StreamableFile> {
    const result: BomExportResult = await this.queryBus.execute(
      new ExportBomsQuery(toReportFilters(body.filters)),
    );
    const workbook = await renderXlsxWorkbook(
      buildBomExportGrid(result.items, body.format, body.timeZone),
      bomExportWorkbookOptions(body.format),
    );
    return xlsxAttachment(workbook, BOM_EXPORT_FILE_NAME);
  }

  @Get('report/filter-options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @ApiOperation({
    summary:
      'List every distinct filterable value across all registered daily BOMs, unfiltered',
  })
  @ApiOkResponse({ schema: BomFilterOptionsSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  async filterOptions(): Promise<BomFilterOptions> {
    return this.queryBus.execute(new BomFilterOptionsQuery());
  }

  // The post-registration preview ("پیش‌نمایش آنالیز روزانه"): read-only and
  // role-free like `get()` below, and computed exactly like the dashboard's
  // per-line deviation. Note the standard weight is the standard BOM's
  // *current* one, and an MI code renamed since registration is a 404 here,
  // as it is on the dashboard. See src/modules/boms/CLAUDE.md.
  @Get(':id/weight-differences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @ApiOperation({
    summary:
      'Get each material line of a daily BOM with its standard weight and its absolute deviation from it, in composition order',
  })
  @ApiOkResponse({ schema: BomWeightDifferencesSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async weightDifferences(
    @Param('id') id: string,
  ): Promise<BomWeightDifferences> {
    return this.queryBus.execute(
      new GetBomWeightDifferencesQuery(Identity.fromString(id)),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PRODUCTION_ROLES)
  @ApiForbiddenResponse({ description: 'Not a production role' })
  @ApiOperation({
    summary:
      "Get a single daily BOM's full detail, including its composition and total weight",
  })
  @ApiOkResponse({ schema: BomDetailSchema })
  @ApiUnauthorizedResponse({ schema: JwtUnauthorizedSchema })
  @ApiNotFoundResponse({ schema: EntityNotFoundSchema })
  async get(@Param('id') id: string): Promise<BomDetail> {
    return this.queryBus.execute(new GetBomQuery(Identity.fromString(id)));
  }
}

// The report and the export share one filter shape. Every key is passed on as
// it arrived — absent stays `undefined` (unfiltered), `[]` stays `[]` (match
// nothing); see `BomReportFilters`.
function toReportFilters(
  filters: BomReportFiltersDto | undefined,
): BomReportFilters {
  return {
    orderNumbers: filters?.orderNumbers,
    trackingNumbers: filters?.trackingNumbers,
    brands: filters?.brands,
    componentNames: filters?.componentNames,
    standardBomMiCodes: filters?.standardBomMiCodes,
    productNames: filters?.productNames,
    registeredByUsers: filters?.registeredByUsers,
    approvalStatuses: filters?.approvalStatuses,
    reviewers: filters?.reviewers,
    registeredAtFrom:
      filters?.registeredAtFrom === undefined
        ? undefined
        : new Date(filters.registeredAtFrom),
    registeredAtTo:
      filters?.registeredAtTo === undefined
        ? undefined
        : new Date(filters.registeredAtTo),
  };
}
