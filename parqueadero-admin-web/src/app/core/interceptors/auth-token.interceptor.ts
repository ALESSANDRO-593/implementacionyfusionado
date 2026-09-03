import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { SESSION_TOKEN_KEY } from '../config/n8n.config';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  const isN8nRequest = request.url.startsWith(environment.n8nBaseUrl);

  if (!token || !isN8nRequest) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};
