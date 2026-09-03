import { HttpInterceptorFn } from '@angular/common/http';
import { AppConfig } from '../config/app-config';

/**
 * Adjunta el JWT del panel (Authorization: Bearer) o el token de sesión de
 * chat (X-Chat-Session) según lo que exista en almacenamiento de sesión.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = sessionStorage.getItem(AppConfig.storageTokenKey);
  const chat = sessionStorage.getItem(AppConfig.storageChatSessionKey);

  let headers = req.headers;
  if (token) headers = headers.set('Authorization', `Bearer ${token}`);
  if (chat) headers = headers.set('X-Chat-Session', chat);

  return next(headers === req.headers ? req : req.clone({ headers }));
};
