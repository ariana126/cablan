/**
 * Spec helpers for the `/pm-plans` board, the equipment folder and its sections: find things the way
 * a screen reader and the acceptance suite do — a region by the heading naming it, a control by its
 * accessible name.
 */

/** Collapses runs of whitespace, as a screen reader reads text. */
export const squeeze = (text: string | null | undefined): string =>
  text?.replace(/\s+/g, ' ').trim() ?? '';

export const texts = (elements: Iterable<Element>): string[] =>
  Array.from(elements).map((element) => squeeze(element.textContent));

/** The text an element is named by: `aria-label`, else its content minus what is `aria-hidden`. */
export const accessibleName = (element: Element): string => {
  const walk = (node: Node): string => {
    if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') {
      return '';
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    return Array.from(node.childNodes).map(walk).join(' ');
  };
  return element.getAttribute('aria-label') ?? squeeze(walk(element));
};

/** A region, found by the heading that names it (`aria-labelledby`). */
export const region = (root: Element, heading: string): Element | undefined =>
  Array.from(root.querySelectorAll('section[aria-labelledby]')).find(
    (section) =>
      squeeze(root.querySelector(`#${section.getAttribute('aria-labelledby')}`)?.textContent) ===
      heading,
  );

/** A button or link within `root`, by its exact accessible name. */
export const controlNamed = (root: Element, name: string): HTMLElement | undefined =>
  Array.from(root.querySelectorAll<HTMLElement>('button, a[href]')).find(
    (control) => accessibleName(control) === name,
  );
