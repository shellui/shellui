import { Component, OnInit, inject } from '@angular/core';
import { ShelluiService } from './shellui.service';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly shellui = inject(ShelluiService);

  ngOnInit(): void {
    this.shellui.start();
  }
}
