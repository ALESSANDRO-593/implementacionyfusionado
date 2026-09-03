import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Mapea errores HTTP a mensajes amigables y centraliza el manejo. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      let message = 'Ocurrió un error inesperado. Intente nuevamente.';
      if (err.status === 0) message = 'No hay conexión con el servidor.';
      else if (err.status === 401) message = 'Sesión no válida o expirada.';
      else if (err.status === 403) message = 'No tiene permisos para esta acción.';
      else if (err.status === 429) message = 'Demasiados intentos. Espere unos minutos.';
      else if (err.error?.error?.message) message = err.error.error.message;
      return throwError(() => ({ status: err.status, message }));
    })
  );
};
