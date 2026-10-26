import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { form, FormField, submit } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatError, MatFormField } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { firstValueFrom } from 'rxjs';

import {
  AppBomDashboardDailyBom,
  AppBomDashboardDailyBomLine,
} from '../../core/bom-dashboard/bom-dashboard-gateway';
import { MaterialLineKey, materialWeightEdit } from '../../core/bom-dashboard/material-weight-edit';
import { BomsGateway } from '../../core/boms/boms-gateway';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { positiveNumber } from '../../core/forms/positive-number';
import { approvalStatusLabel, reviewerLabel } from '../../core/i18n/approval-labels';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { StackedTable } from '../../ui/stacked-table/stacked-table';
import { WeightDifference } from '../../ui/weight-difference/weight-difference';
import {
  DailyBomDescriptionDialog,
  DailyBomDescriptionDialogData,
} from './daily-bom-description-dialog';
import {
  DailyBomRejectionDialog,
  DailyBomRejectionDialogData,
  DailyBomRejectionOutcome,
} from './daily-bom-rejection-dialog';
import { ALREADY_REVIEWED, approvalFailure, isAlreadyReviewed } from './server-errors';

const READ_COLUMNS = [
  'componentName',
  'materialName',
  'standardWeight',
  'difference',
  'actualWeight',
];
const EDIT_COLUMNS = [...READ_COLUMNS, 'edit'];

const SNACK_BAR_OPTIONS = { duration: 5000 };

/** Gives each card's order number its own id, for its review button's `aria-describedby`. */
let nextCardId = 0;

type Deviation = 'above' | 'below';

interface WeightModel {
  weight: number;
}

/** «وزن مواد اولیه مسی جز مغزی» — how the feature names one line, and so how its input is named. */
function lineName(line: AppBomDashboardDailyBomLine): string {
  return `وزن مواد اولیه ${line.materialName} جز ${line.componentName}`;
}

/** The line's pencil, «ویرایش وزن مواد اولیه {material} جز {component}». */
function pencilSelector(line: AppBomDashboardDailyBomLine): string {
  return `button[aria-label="ویرایش ${lineName(line)}"]`;
}

/** The description's pencil; every card's reads the same, told apart by its order number. */
const DESCRIPTION_PENCIL = 'button[aria-label="ویرایش توضیحات"]';

/** The expansion panel's header — itself a button, and the card's one control that outlives a
 * review. */
const PANEL_HEADER = 'mat-expansion-panel-header';

function isSameLine(line: AppBomDashboardDailyBomLine, key: MaterialLineKey | null): boolean {
  return key !== null && line.componentId === key.componentId && line.materialId === key.materialId;
}

function isForbidden(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 403;
}

/** Why a weight correction was refused, in words the visitor can act on. */
function weightSaveFailure(error: unknown): string {
  if (isForbidden(error)) {
    return 'شما اجازهٔ ویرایش آنالیز روزانه را ندارید.';
  }
  // The edit re-sends the whole composition, checked against the standard BOM's *current* one; a
  // line the standard BOM has since dropped can no longer be saved from here.
  if (toProblemDetails(error)?.type === PROBLEM.bomCompositionEntryNotFound) {
    return 'این آنالیز روزانه اجزا یا مواد اولیه‌ای دارد که دیگر در آنالیز استاندارد نیست؛ ویرایش وزن ممکن نیست.';
  }
  return 'وزن مواد اولیه ذخیره نشد.';
}

/**
 * One daily BOM on the dashboard's per-product panel: an expansion panel whose header names it —
 * order number, tracking number, registration time, the quality-control operator, its approval
 * status and reviewer («تایید/رد کننده») — and whose body holds the description, the management
 * note when the review left one, and the per-line table (component, material, standard weight,
 * difference, registered weight). It starts open, so the numbers are on screen without a click.
 *
 * **Each line is shown against its standard**: the standard BOM's weight for the same material,
 * then the difference the API computes — the absolute deviation `|registered − standard|`, never
 * negative, so a line 2 under standard and one 2 over both read ۲. The direction is therefore
 * derived here from the two weights (`deviationOf`) and shown by `app-weight-difference`: an arrow
 * and a colour pair, plus words for a screen reader. A line on its standard — a difference of zero
 * — leaves the cell empty. After a weight correction the re-read `bom` brings the API's new
 * difference, so the card never computes one of its own that could disagree.
 *
 * **For Management and System Admin (`canApprove`) it is also where the daily BOM is reviewed.**
 * The body offers «تایید» and «عدم تایید» while the daily BOM is pending, and nothing once it is
 * reviewed — a review is final until an edit sends it back to pending. «عدم تایید» opens
 * `DailyBomRejectionDialog` for the required reason. Every line gets a pencil, «ویرایش وزن مواد
 * اولیه {material} جز {component}», that swaps its weight for an input and «ذخیره». A pencil beside
 * the description, «ویرایش توضیحات», opens `DailyBomDescriptionDialog`. The buttons sit in the body
 * rather than the header, because the header is itself a button and a button inside a button is
 * not operable.
 *
 * **Every write ends by asking the page to re-read the list (`changed`)**, never by patching the
 * card: a weight correction moves the score the list is ordered by and sends a reviewed daily BOM
 * back to pending, and a review may be refused because someone else reviewed it first
 * (`bom-already-reviewed`, also re-read) — only the API knows the result. The review buttons stay
 * disabled from the click until the re-read arrives (the `busy` flag resets when the `bom` input
 * does), so they cannot be pressed twice. The weight input closes as soon as the save is answered,
 * and focus goes back to the line's pencil.
 *
 * **Focus survives the re-read.** The new `bom` makes the table render its rows afresh, which would
 * destroy whatever had focus; so after a write the card remembers what to focus — the line's pencil,
 * or, after a review took the buttons away, the card's header — and focuses it again once the
 * re-read arrives.
 */
@Component({
  selector: 'app-daily-bom-card',
  imports: [
    FormField,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatError,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatFormField,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatIconButton,
    MatInput,
    MatRow,
    MatRowDef,
    MatTable,
    PersianNumberPipe,
    StackedTable,
    WeightDifference,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-bom-card.html',
  styleUrl: './daily-bom-card.scss',
})
export class DailyBomCard {
  private readonly gateway = inject(BomsGateway);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly bom = input.required<AppBomDashboardDailyBom>();
  /** Management and System Admin only — see `canApproveBoms`. */
  readonly canApprove = input(false);
  /** The daily BOM changed on the server; the page re-reads its list. */
  readonly changed = output<void>();

  protected readonly lineColumns = computed(() =>
    this.canApprove() ? EDIT_COLUMNS : READ_COLUMNS,
  );
  protected readonly approvalStatusLabel = approvalStatusLabel;
  protected readonly reviewerLabel = reviewerLabel;
  protected readonly lineName = lineName;
  /** Every card's review buttons read just «تایید» and «عدم تایید» (the names the acceptance suite
   * locates them by); their description, the card's order number, is what tells them apart. */
  protected readonly orderNumberId = `daily-bom-order-number-${nextCardId++}`;

  /** An approval is out, or answered and waiting for the re-read. */
  protected readonly busy = linkedSignal({ source: this.bom, computation: () => false });

  /** The line whose weight is open for editing; one per card at a time. */
  protected readonly editing = signal<MaterialLineKey | null>(null);
  protected readonly saving = signal(false);

  /** What to focus once the re-read `bom` has rendered, as a selector inside this card. */
  private readonly focusAfterReread = signal<string | null>(null);

  private readonly weightModel = signal<WeightModel>({ weight: 0 });
  protected readonly weightForm = form(this.weightModel, (path) => {
    positiveNumber(path.weight, { message: 'وزن مواد اولیه را به صورت عدد مثبت وارد کنید.' });
  });

  constructor() {
    effect(() => {
      this.bom();
      const selector = untracked(this.focusAfterReread);
      if (selector === null) {
        return;
      }
      this.focusAfterReread.set(null);
      this.focusAfterRender(selector);
    });
  }

  protected formatRegisteredAt(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '—' : formatJalaliDateTime(parsed);
  }

  /** Only asked of a line with a non-zero difference; an exact match renders no pill at all. */
  protected deviationOf(line: AppBomDashboardDailyBomLine): Deviation {
    return line.actualWeight > line.standardWeight ? 'above' : 'below';
  }

  protected isEditing(line: AppBomDashboardDailyBomLine): boolean {
    return isSameLine(line, this.editing());
  }

  protected onApprove(): void {
    this.busy.set(true);
    this.gateway.approve(this.bom().id).subscribe({
      complete: () => this.reviewed(),
      error: (error: unknown) => {
        this.snackBar.open(approvalFailure(error), 'باشه', SNACK_BAR_OPTIONS);
        if (isAlreadyReviewed(error)) {
          // Someone reviewed it first: the card is stale, so re-read it to show by whom.
          this.reviewed();
        } else {
          this.busy.set(false);
        }
      },
    });
  }

  protected onReject(): void {
    const bom = this.bom();
    this.dialog
      .open<DailyBomRejectionDialog, DailyBomRejectionDialogData, DailyBomRejectionOutcome>(
        DailyBomRejectionDialog,
        { data: { bomId: bom.id, orderNumber: bom.orderNumber } },
      )
      .afterClosed()
      .subscribe((outcome) => {
        if (outcome === undefined) {
          return;
        }
        if (outcome === 'already-reviewed') {
          this.snackBar.open(ALREADY_REVIEWED, 'باشه', SNACK_BAR_OPTIONS);
        }
        // Either way the card is stale: re-read it to show the review, whoever made it.
        this.reviewed();
      });
  }

  protected onEditDescription(): void {
    const bom = this.bom();
    this.dialog
      .open<DailyBomDescriptionDialog, DailyBomDescriptionDialogData, boolean>(
        DailyBomDescriptionDialog,
        { data: { bomId: bom.id, description: bom.description } },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.focusAfterReread.set(DESCRIPTION_PENCIL);
          this.changed.emit();
        }
      });
  }

  protected onEdit(line: AppBomDashboardDailyBomLine): void {
    this.weightModel.set({ weight: line.actualWeight });
    this.weightForm().reset();
    this.editing.set({ componentId: line.componentId, materialId: line.materialId });
    this.focusAfterRender(`input[aria-label="${lineName(line)}"]`);
  }

  protected onCancel(line: AppBomDashboardDailyBomLine): void {
    this.closeEditor(line);
  }

  protected onSave(line: AppBomDashboardDailyBomLine): Promise<boolean> {
    return submit(this.weightForm, async () => {
      const edit = materialWeightEdit(
        this.bom(),
        { componentId: line.componentId, materialId: line.materialId },
        this.weightModel().weight,
      );
      this.saving.set(true);
      try {
        await firstValueFrom(this.gateway.update(this.bom().id, edit), { defaultValue: undefined });
      } catch (error) {
        this.snackBar.open(weightSaveFailure(error), 'باشه', SNACK_BAR_OPTIONS);
        return undefined;
      } finally {
        this.saving.set(false);
      }
      this.closeEditor(line);
      this.focusAfterReread.set(pencilSelector(line));
      this.changed.emit();
      return undefined;
    });
  }

  /** Closes the input and gives focus back to the line's pencil, which is about to be its only control. */
  private closeEditor(line: AppBomDashboardDailyBomLine): void {
    this.editing.set(null);
    this.focusAfterRender(pencilSelector(line));
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  /**
   * The daily BOM has been approved or rejected: ask for the re-read. A reviewed card offers no
   * review buttons, so the one pressed is about to vanish; focus its header instead, the card's own
   * control, once the re-read renders. (If the filters drop the card, the page moves focus.)
   */
  private reviewed(): void {
    this.focusAfterReread.set(PANEL_HEADER);
    this.changed.emit();
  }
}
