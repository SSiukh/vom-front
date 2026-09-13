import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ServerStatusBanner } from './core/layout/server-status-banner/server-status-banner';

@Component({
  imports: [RouterOutlet, ServerStatusBanner],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
