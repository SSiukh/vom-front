import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ServerConnectionService } from './core/connection/server-connection.service';
import { authRefreshInterceptor } from './core/interceptors/auth-refresh.interceptor';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { requestTimeoutInterceptor } from './core/interceptors/request-timeout.interceptor';
import { serverWakeInterceptor } from './core/interceptors/server-wake.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authTokenInterceptor, authRefreshInterceptor, serverWakeInterceptor, requestTimeoutInterceptor]),
    ),
    provideAppInitializer(() => inject(ServerConnectionService).startMonitoring()),
  ]
};
