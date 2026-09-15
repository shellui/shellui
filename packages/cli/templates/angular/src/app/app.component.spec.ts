import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ShelluiService } from './shellui.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: ShelluiService,
          useValue: {
            start: () => undefined,
            t: (key: string) =>
              ({
                title: 'Welcome to Shellui',
                blurb: 'blurb',
                themeLabel: 'Theme',
                languageLabel: 'Language',
                hint: 'hint',
                fallbackLanguage: 'en',
              })[key] ?? key,
            themeLabel: () => 'shellui · light',
            language: () => 'en',
            theme: () => null,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render Shellui home title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Welcome to Shellui');
  });
});
