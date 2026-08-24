import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

describe('Pagination', () => {
  let fixture: ComponentFixture<Pagination>;
  let el: HTMLElement;

  const configure = (page: number, pageSize: number, total: number) => {
    TestBed.configureTestingModule({ imports: [Pagination] });
    fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('pageSize', pageSize);
    fixture.componentRef.setInput('total', total);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  };

  it('renders nothing when everything fits on one page', () => {
    configure(1, 10, 7);
    expect(el.querySelector('.pagination')).toBeNull();
  });

  it('shows the correct range text', () => {
    configure(2, 10, 25);
    expect(el.querySelector('.pagination span')?.textContent?.trim()).toBe('11-20 з 25');
  });

  it('caps the range end at the total on the last page', () => {
    configure(3, 10, 25);
    expect(el.querySelector('.pagination span')?.textContent?.trim()).toBe('21-25 з 25');
  });

  it('renders every page number when there are 7 or fewer pages', () => {
    configure(1, 10, 70);
    const boxes = Array.from(el.querySelectorAll('.pagination-box')).map((b) => b.textContent?.trim());
    expect(boxes).toEqual(['', '1', '2', '3', '4', '5', '6', '7', '']);
  });

  it('collapses distant pages behind an ellipsis for large page counts', () => {
    configure(5, 10, 200);
    const items = Array.from(el.querySelectorAll('.pagination-pages > *')).map((n) => n.textContent?.trim());
    expect(items).toEqual(['', '1', '…', '4', '5', '6', '…', '20', '']);
  });

  it('marks the current page as active and disabled', () => {
    configure(2, 10, 30);
    const activeBox = el.querySelector('.pagination-box.is-active') as HTMLButtonElement;
    expect(activeBox.textContent?.trim()).toBe('2');
    expect(activeBox.disabled).toBe(true);
  });

  it('emits pageChange when a page number is clicked', () => {
    configure(1, 10, 30);
    const pageChange = vi.fn();
    fixture.componentInstance.pageChange.subscribe(pageChange);

    const pageThree = Array.from(el.querySelectorAll('.pagination-box')).find(
      (b) => b.textContent?.trim() === '3',
    ) as HTMLButtonElement;
    pageThree.click();

    expect(pageChange).toHaveBeenCalledWith(3);
  });

  it('disables the prev button on the first page', () => {
    configure(1, 10, 30);
    const boxes = el.querySelectorAll('.pagination-box');
    expect((boxes[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables the next button on the last page', () => {
    configure(3, 10, 30);
    const boxes = el.querySelectorAll('.pagination-box');
    expect((boxes[boxes.length - 1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('emits pageChange on next/previous clicks', () => {
    configure(2, 10, 30);
    const pageChange = vi.fn();
    fixture.componentInstance.pageChange.subscribe(pageChange);
    const boxes = el.querySelectorAll('.pagination-box');

    (boxes[0] as HTMLButtonElement).click();
    expect(pageChange).toHaveBeenCalledWith(1);

    (boxes[boxes.length - 1] as HTMLButtonElement).click();
    expect(pageChange).toHaveBeenCalledWith(3);
  });
});
