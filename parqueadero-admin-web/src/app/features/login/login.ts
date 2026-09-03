import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly isSubmitting = signal(false);
  protected readonly loginError = signal('');
  protected readonly passwordVisible = signal(false);
  protected readonly showLocalCredentials = !environment.production;

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    cedula: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(200)]]
  });

  protected submit(): void {
    if (this.loginForm.invalid || this.isSubmitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.loginError.set('');

    this.auth.login(this.loginForm.getRawValue()).subscribe({
      next: () => {
        const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const destination = requestedUrl?.startsWith('/') && !requestedUrl.startsWith('//')
          ? requestedUrl
          : '/dashboard';
        void this.router.navigateByUrl(destination);
      },
      error: (error: HttpErrorResponse) => {
        this.loginError.set(
          error.error?.error
          ?? (error.status === 0
            ? 'No fue posible iniciar sesión. Intente nuevamente.'
            : 'No fue posible iniciar sesión.')
        );
        this.isSubmitting.set(false);
      }
    });
  }
}
