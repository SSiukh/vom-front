import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Footer } from './footer';

describe('Footer', () => {
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
  });

  it('renders the wordmark and the copyright text', () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.wordmark')?.textContent?.trim()).toBe('VOM');
    expect(el.querySelector('.copyright')?.textContent?.trim()).toBe('© 2026 VOM');
  });
});
