import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';

/** The IEC 60445 core colours a cable spec can list; `pe` is protective earth, green and yellow. */
export type CoreColour = 'brown' | 'black' | 'grey' | 'blue' | 'pe';
export type ConductorMaterial = 'copper' | 'aluminium';

const CORE_NAMES: Readonly<Record<CoreColour, string>> = {
  brown: 'قهوه‌ای',
  black: 'مشکی',
  grey: 'خاکستری',
  blue: 'آبی',
  pe: 'سبز-زرد',
};

const MATERIAL_NAMES: Readonly<Record<ConductorMaterial, string>> = {
  copper: 'مس',
  aluminium: 'آلومینیوم',
};

const COUNT_WORDS = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج'] as const;

/**
 * A cable's cores and conductor material as small round swatches, each followed by its name, for BOM
 * tables, product specs and filters. These are physical colours, never a status: the same green is
 * not "success".
 *
 * In the full form every swatch is followed by its name, so the swatches are decoration and are
 * hidden from assistive technology. In the compact form (dense tables) only the swatches show; the
 * group is one image whose accessible name lists the cores in order, and a tooltip says the same.
 */
@Component({
  selector: 'app-conductor-colours',
  imports: [MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compact()) {
      <span
        class="conductor-colours conductor-colours--compact"
        role="img"
        [attr.aria-label]="summary()"
        [matTooltip]="summary()"
      >
        @for (core of cores(); track $index) {
          <span class="swatch" [class]="'swatch swatch--' + core"></span>
        }
        @if (material(); as kind) {
          <span class="swatch" [class]="'swatch swatch--' + kind"></span>
        }
      </span>
    } @else {
      <span class="conductor-colours">
        @for (core of cores(); track $index) {
          <span class="conductor-colours__item">
            <span class="swatch" [class]="'swatch swatch--' + core" aria-hidden="true"></span>
            {{ coreName(core) }}
          </span>
        }
        @if (material(); as kind) {
          <span class="conductor-colours__item">
            <span class="swatch" [class]="'swatch swatch--' + kind" aria-hidden="true"></span>
            {{ materialName(kind) }}
          </span>
        }
      </span>
    }
  `,
  styleUrl: './conductor-colours.scss',
})
export class ConductorColours {
  /** In core order. */
  readonly cores = input<readonly CoreColour[]>([]);
  readonly material = input<ConductorMaterial>();
  /** Swatches only, with the names in the accessible name and a tooltip. */
  readonly compact = input(false);

  protected readonly summary = computed(() => {
    const cores = this.cores();
    const parts: string[] = [];
    if (cores.length > 0) {
      const count = COUNT_WORDS[cores.length] || formatPersianNumber(cores.length);
      parts.push(`${count} رشته: ${cores.map((core) => CORE_NAMES[core]).join('، ')}`);
    }
    const material = this.material();
    if (material !== undefined) {
      parts.push(`هادی: ${MATERIAL_NAMES[material]}`);
    }
    return parts.join('؛ ');
  });

  protected coreName(core: CoreColour): string {
    return CORE_NAMES[core];
  }

  protected materialName(material: ConductorMaterial): string {
    return MATERIAL_NAMES[material];
  }
}
