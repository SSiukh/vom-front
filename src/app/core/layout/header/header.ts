import { Component, inject } from '@angular/core';
import { LucideLogOut } from '@lucide/angular';
import { AuthService } from '../../auth/auth.service';
import { LayoutStateService } from '../layout-state.service';

@Component({
  selector: 'app-header',
  imports: [LucideLogOut],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly authService = inject(AuthService);
  protected readonly layoutState = inject(LayoutStateService);
}
