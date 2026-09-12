import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
// @ts-ignore - SDK may not have types
import shellui from '@shellui/sdk';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  settings: any = null;
  user: any = null;

  async ngOnInit() {
    // Initialize Shellui SDK
    await shellui.ready();

    // Get settings from parent shell
    this.settings = shellui.getSettings();

    // Get current user if authenticated
    this.user = shellui.getUser();

    console.log('Shellui SDK initialized', {
      settings: this.settings,
      user: this.user,
    });
  }

  handleShowToast() {
    shellui.showToast({
      title: 'Hello from Angular!',
      description: 'This is a toast notification from your Angular app.',
    });
  }

  stringify(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }
}
