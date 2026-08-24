import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DictionariesService } from '../../dictionaries/dictionaries.service';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Header, Sidebar, Footer],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  constructor() {
    inject(DictionariesService);
  }
}
