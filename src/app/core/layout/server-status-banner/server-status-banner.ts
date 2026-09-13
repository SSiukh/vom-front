import { Component, inject } from '@angular/core';
import { LucideLoaderCircle, LucideRefreshCw, LucideWifiOff } from '@lucide/angular';
import { ServerConnectionService } from '../../connection/server-connection.service';

@Component({
  selector: 'app-server-status-banner',
  imports: [LucideLoaderCircle, LucideRefreshCw, LucideWifiOff],
  templateUrl: './server-status-banner.html',
  styleUrl: './server-status-banner.css',
})
export class ServerStatusBanner {
  protected readonly connection = inject(ServerConnectionService);

  retry(): void {
    this.connection.retryBlockedNavigation();
  }
}
