import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Agrega el header X-Api-Key a toda petición hacia el backend de n8n, para
 * que los webhooks (protegidos con Header Auth) la acepten. Sin este header,
 * n8n responde 403 antes de ejecutar cualquier workflow.
 */
@Injectable()
export class ApiKeyInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!req.url.startsWith(environment.n8nBaseUrl)) {
      return next.handle(req);
    }

    let headers = req.headers.set('X-Api-Key', environment.apiKey);
    const sesionChat = sessionStorage.getItem('yavibot.chat.session');
    if (sesionChat) headers = headers.set('X-Chat-Session', sesionChat);

    return next.handle(req.clone({ headers }));
  }
}
