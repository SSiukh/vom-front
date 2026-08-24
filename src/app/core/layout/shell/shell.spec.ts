import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { DictionariesService } from '../../dictionaries/dictionaries.service';
import { LayoutStateService } from '../layout-state.service';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;

  beforeEach(() => {
    const authServiceStub = {
      isAuthenticated: () => false,
      login: () => null,
      logout: vi.fn(),
    } as unknown as AuthService;
    const dictionariesServiceStub = {} as DictionariesService;

    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: DictionariesService, useValue: dictionariesServiceStub },
      ],
    });
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
  });

  it('composes the header, sidebar, footer and a router outlet', () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-header')).not.toBeNull();
    expect(el.querySelector('app-sidebar')).not.toBeNull();
    expect(el.querySelector('app-footer')).not.toBeNull();
    expect(el.querySelector('router-outlet')).not.toBeNull();
  });

  it('renders exactly one "VOM" wordmark, migrating from sidebar to header on collapse', () => {
    const el = fixture.nativeElement as HTMLElement;
    const layoutState = TestBed.inject(LayoutStateService);

    expect(el.querySelectorAll('app-header .wordmark, app-sidebar .wordmark').length).toBe(1);
    expect(el.querySelector('app-sidebar .wordmark')).not.toBeNull();
    expect(el.querySelector('app-header .wordmark')).toBeNull();

    layoutState.toggleSidebar();
    fixture.detectChanges();

    expect(el.querySelectorAll('app-header .wordmark, app-sidebar .wordmark').length).toBe(1);
    expect(el.querySelector('app-sidebar .wordmark')).toBeNull();
    expect(el.querySelector('app-header .wordmark')).not.toBeNull();
  });
});

describe('Shell (eager DictionariesService construction)', () => {
  it('constructs DictionariesService as soon as the shell renders, not on first feature use', () => {
    const constructed = vi.fn();
    class DictionariesServiceSpy {
      constructor() {
        constructed();
      }
    }

    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => false, login: () => null } },
        { provide: DictionariesService, useClass: DictionariesServiceSpy },
      ],
    });

    expect(constructed).not.toHaveBeenCalled();
    TestBed.createComponent(Shell).detectChanges();
    expect(constructed).toHaveBeenCalledOnce();
  });
});
