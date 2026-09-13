import { bootstrapApplication } from '@angular/platform-browser';
import { shellui } from '@shellui/sdk/tiny';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Light Shellui host handshake when embedded (no-op outside the shell).
void shellui.ready;

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
