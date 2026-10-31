import { Directive, effect, ElementRef, inject, input, Renderer2 } from '@angular/core';

/** A circle as path data, so every glyph is a plain list of `d` strings. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

const CALENDAR =
  'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4';

/**
 * The app's line icons, by name. Each is drawn on a 24px grid as stroked paths; the directive below
 * supplies the stroke style, so a glyph here is geometry only.
 *
 * **Drawn for right-to-left.** The document is `dir="rtl"` and nothing in this app renders
 * left-to-right, so a directional glyph is drawn the way it points in Persian rather than mirrored
 * at run time: «بازگشت» (`back`) points right, a checklist's ticks sit on the right, «برگرداندن»
 * (`undo`) turns back to the right. Glyphs that read the same both ways (plus, check, chevrons up
 * and down) need no such care.
 */
const ICONS = {
  // Actions
  add: ['M12 5v14M5 12h14'],
  edit: ['M4 20l4-1L19 8l-3-3L5 16z'],
  delete: ['M4 7h16M10 11v6M14 11v6', 'M6 7l1 13h10l1-13M9 7V4h6v3'],
  close: ['M6 6l12 12M18 6L6 18'],
  cancel: [circle(12, 12, 9), 'M9 9l6 6M15 9l-6 6'],
  check: ['M5 12l5 5L20 7'],
  'check-circle': [circle(12, 12, 9), 'M8 12l3 3 5-6'],
  save: [
    'M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M7 3v5h8',
    'M7 21v-7h10v7',
  ],
  filter: ['M4 5h16l-6 8v6l-4-2v-4z'],
  clear: ['M14.5 4.5l5 5L11 18H6.5l-3-3z', 'M9 10l5 5', 'M11 21h9'],
  block: [circle(12, 12, 9), 'M5.6 5.6l12.8 12.8'],
  retry: ['M21 12a9 9 0 1 1-9-9c2.5 0 4.9 1 6.7 2.7L21 8', 'M21 3v5h-5'],
  resample: [
    'M3 12a9 9 0 0 1 9-9c2.5 0 4.9 1 6.7 2.7L21 8',
    'M21 3v5h-5',
    'M21 12a9 9 0 0 1-9 9c-2.5 0-4.9-1-6.7-2.7L3 16',
    'M8 16H3v5',
  ],
  undo: ['M15 14l5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  back: ['M5 12h14', 'M13 6l6 6-6 6'],
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  login: ['M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4', 'M21 12H10', 'M14 8l-4 4 4 4'],
  details: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', circle(12, 12, 3)],
  history: ['M3 12a9 9 0 1 0 9-9c-2.5 0-4.9 1-6.7 2.7L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
  spreadsheet: [
    'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
    'M4 9h16M4 15h16M10 3v18',
  ],
  calendar: [CALENDAR],
  'calendar-check': [CALENDAR, 'M9 15l2 2 4-4'],
  'calendar-days': [CALENDAR, 'M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01'],
  clock: [circle(12, 12, 9), 'M12 7v5l3 2'],

  // Navigation: the work areas and the pages under them
  'quality-control': [
    'M9 4h6v3H9z',
    'M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2',
    'M9 14l2 2 4-4',
  ],
  wrench: [
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
  ],
  database: [
    'M5 6a7 3 0 1 0 14 0a7 3 0 1 0-14 0',
    'M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6',
    'M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6',
  ],
  shield: ['M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6z', 'M9 12l2 2 4-4'],
  'bar-chart': ['M4 20V10M10 20V4M16 20v-8M22 20H2'],
  'pie-chart': ['M21 12a9 9 0 1 1-9-9v9z', 'M15 3.5a9 9 0 0 1 5.5 5.5H15z'],
  scale: [
    'M12 3v18',
    'M8 21h8',
    'M5 7h14',
    'M2 14l3-7 3 7a3 3 0 0 1-6 0z',
    'M16 14l3-7 3 7a3 3 0 0 1-6 0z',
  ],
  verified: [
    'M3.9 8.6a4 4 0 0 1 4.8-4.8 4 4 0 0 1 6.7 0 4 4 0 0 1 4.8 4.8 4 4 0 0 1 0 6.7 4 4 0 0 1-4.8 4.8 4 4 0 0 1-6.7 0 4 4 0 0 1-4.8-4.8 4 4 0 0 1 0-6.7z',
    'M9 12l2 2 4-4',
  ],
  dashboard: ['M4 4h7v9H4z', 'M13 4h7v5h-7z', 'M13 11h7v9h-7z', 'M4 15h7v5H4z'],
  checklist: [
    'M4 6h10M4 12h10M4 18h10',
    'M17 6l1.5 1.5L21 5',
    'M17 12l1.5 1.5L21 11',
    'M17 18l1.5 1.5L21 17',
  ],
  package: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M12 12l8-4.5M12 12L4 7.5M12 12v9'],
  layers: ['M12 3l9 4.5-9 4.5-9-4.5z', 'M3 12l9 4.5 9-4.5', 'M3 16.5l9 4.5 9-4.5'],
  flask: [
    'M9 3h6',
    'M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3',
    'M7 15h10',
  ],
  cog: [
    circle(12, 12, 6),
    circle(12, 12, 2),
    'M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8',
  ],
  hammer: [
    'M15 12l-8.4 8.4a2.1 2.1 0 0 1-3-3L12 9',
    'M18 15l4-4',
    'M21.5 11.5l-1.9-1.9A2 2 0 0 1 19 8.2V7l-2.3-2.3A6 6 0 0 0 12.5 3H9l.9.8A6.2 6.2 0 0 1 12 8.4V10l2 2h1.2a2 2 0 0 1 1.4.6l1.9 1.9',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    circle(9, 7, 4),
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  document: ['M7 3h7l5 5v13H7z', 'M14 3v5h5'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;

/** Every name the directive knows, for specs that sweep the whole set. */
export const ICON_NAMES = Object.keys(ICONS) as readonly IconName[];

const SVG_NAMESPACE = 'svg';

/**
 * Draws one of `ICONS` inside the `mat-icon` it sits on: `<mat-icon appIcon="add" />`.
 *
 * Inline SVG, per the design system — there is no icon font, so the ligature form would render its
 * literal word. The SVG is the `mat-icon`'s direct child, which is what Material's button, menu and
 * list styles size and space (a wrapper component in between would fall outside their `> .mat-icon`
 * selectors). An attribute directive rather than a component so it can share the element with
 * `MatIcon`, the way Material's own `svgIcon` does — without the registry, whose lookups would make
 * every spec register the set first.
 *
 * Decoration: `mat-icon` is `aria-hidden`, and the label beside it carries the meaning, so adding
 * an icon to a button never changes its accessible name.
 */
@Directive({ selector: '[appIcon]' })
export class Icon {
  readonly appIcon = input.required<IconName>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private drawn: SVGElement | null = null;

  constructor() {
    effect(() => this.draw(ICONS[this.appIcon()]));
  }

  private draw(paths: readonly string[]): void {
    const svg: SVGElement = this.renderer.createElement('svg', SVG_NAMESPACE);
    for (const [name, value] of Object.entries({
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })) {
      this.renderer.setAttribute(svg, name, value);
    }
    for (const d of paths) {
      const path: SVGPathElement = this.renderer.createElement('path', SVG_NAMESPACE);
      this.renderer.setAttribute(path, 'd', d);
      this.renderer.appendChild(svg, path);
    }

    if (this.drawn) {
      this.renderer.removeChild(this.host.nativeElement, this.drawn);
    }
    this.renderer.appendChild(this.host.nativeElement, svg);
    this.drawn = svg;
  }
}
