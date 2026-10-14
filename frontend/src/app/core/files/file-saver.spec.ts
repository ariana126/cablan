import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileSaver } from './file-saver';

describe('FileSaver', () => {
  let clicked: { href: string; download: string; attached: boolean }[];

  beforeEach(() => {
    vi.useFakeTimers();
    clicked = [];
    // jsdom implements neither object URLs nor navigation, so both ends are observed here: the URL
    // made from the blob, and the `<a download>` click a real browser turns into a download event.
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/1');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download, attached: this.isConnected });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads the blob under the given file name, through a clicked <a download>', () => {
    const blob = new Blob(['xlsx']);

    TestBed.inject(FileSaver).save(blob, 'گزارش.xlsx');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([
      { href: 'blob:http://localhost/1', download: 'گزارش.xlsx', attached: true },
    ]);
  });

  it('leaves no anchor behind in the document', () => {
    TestBed.inject(FileSaver).save(new Blob(['xlsx']), 'گزارش.xlsx');

    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('releases the object URL only once the browser has had time to start the download', () => {
    TestBed.inject(FileSaver).save(new Blob(['xlsx']), 'گزارش.xlsx');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/1');
  });
});
