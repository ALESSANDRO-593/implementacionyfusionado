import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { homeForRol } from '../../core/guards/role-guard';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  cedula = signal('');
  password = signal('');
  error = signal('');
  cargando = signal(false);

  entrar() {
    if (this.cargando()) return;
    this.error.set('');
    const ced = this.cedula().trim();
    const pwd = this.password();
    if (!ced || !pwd) { this.error.set('Ingrese usuario y contraseña.'); return; }
    this.cargando.set(true);
    this.auth.login(ced, pwd).subscribe({
      next: (r) => {
        this.cargando.set(false);
        if (r.ok) this.router.navigateByUrl(homeForRol(this.auth.rolId()));
        else this.error.set(r.error?.message ?? 'No se pudo iniciar sesión.');
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(e.message ?? 'Usuario o contraseña incorrectos.');
      },
    });
  }
}
