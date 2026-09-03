import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { InstitutionalPerson, ParkingServiceStatus, ParkingUser, ParkingUserType } from './models/parking-user.model';
import { ParkingUsersService } from './services/parking-users.service';

type TypeFilter = 'TODOS' | ParkingUserType;
type StatusFilter = 'TODOS' | ParkingServiceStatus;

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class Users implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly parkingUsersService = inject(ParkingUsersService);

  protected readonly users = signal<ParkingUser[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');
  protected readonly searchTerm = signal('');
  protected readonly typeFilter = signal<TypeFilter>('TODOS');
  protected readonly statusFilter = signal<StatusFilter>('TODOS');
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly mutationError = signal('');
  protected readonly userPendingDeletion = signal<ParkingUser | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal('');

  protected readonly guestForm = this.formBuilder.nonNullable.group({
    identification: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    institutionalEmail: ['', [Validators.required, Validators.email, Validators.maxLength(150)]]
  });

  protected readonly filteredUsers = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('es');
    const type = this.typeFilter();
    const status = this.statusFilter();

    return this.users().filter(user => {
      const matchesQuery = !query || [
        user.fullName,
        user.identification,
        user.institutionalEmail,
        ...user.vehicles
      ].some(value => value.toLocaleLowerCase('es').includes(query));

      return matchesQuery
        && (type === 'TODOS' || user.type === type)
        && (status === 'TODOS' || user.serviceStatus === status);
    });
  });
  protected readonly hasActiveFilters = computed(() =>
    this.searchTerm().trim() !== '' || this.typeFilter() !== 'TODOS' || this.statusFilter() !== 'TODOS'
  );

  ngOnInit(): void {
    this.loadUsers();
  }

  protected loadUsers(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    this.parkingUsersService.list().subscribe({
      next: users => {
        this.users.set(users);
        this.isLoading.set(false);
      },
      error: () => {
        this.users.set([]);
        this.loadError.set('No fue posible consultar los usuarios.');
        this.isLoading.set(false);
      }
    });
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateTypeFilter(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value as TypeFilter);
  }

  protected updateStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.isDeleting()) return;
    if (this.userPendingDeletion()) this.closeDeleteConfirmation();
    else if (this.isModalOpen()) this.closeRegistration();
  }

  protected openRegistration(): void {
    this.guestForm.reset({ identification: '', fullName: '', institutionalEmail: '' });
    this.mutationError.set('');
    this.isModalOpen.set(true);
  }

  protected closeRegistration(): void {
    this.isModalOpen.set(false);
  }

  protected registerGuest(): void {
    if (this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      return;
    }
    const values = this.guestForm.getRawValue();
    this.persistParkingUser({
      sourceId: null,
      type: 'INVITADO',
      identification: values.identification,
      fullName: values.fullName.trim(),
      institutionalEmail: values.institutionalEmail.trim().toLocaleLowerCase('es')
    });
  }

  private persistParkingUser(person: InstitutionalPerson): void {
    this.isSaving.set(true);
    this.mutationError.set('');
    this.parkingUsersService.create(person).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeRegistration();
        this.loadUsers();
      },
      error: error => {
        this.mutationError.set(error.error?.error ?? 'No fue posible registrar el usuario.');
        this.isSaving.set(false);
      }
    });
  }

  protected toggleEnabled(userId: number): void {
    const user = this.users().find(item => item.id === userId);
    if (!user) return;

    const enabled = !user.enabled;
    this.parkingUsersService.setEnabled(userId, enabled).subscribe({
      next: () => this.loadUsers(),
      error: () => this.loadError.set('No fue posible actualizar el estado del usuario.')
    });
  }

  protected openDeleteConfirmation(user: ParkingUser): void {
    this.deleteError.set('');
    this.userPendingDeletion.set(user);
  }

  protected closeDeleteConfirmation(): void {
    if (this.isDeleting()) return;
    this.userPendingDeletion.set(null);
    this.deleteError.set('');
  }

  protected confirmDelete(): void {
    const user = this.userPendingDeletion();
    if (!user || this.isDeleting()) return;

    this.isDeleting.set(true);
    this.deleteError.set('');
    this.parkingUsersService.delete(user.id).subscribe({
      next: () => {
        this.users.update(users => users.filter(item => item.id !== user.id));
        this.isDeleting.set(false);
        this.userPendingDeletion.set(null);
      },
      error: error => {
        this.deleteError.set(error.error?.error ?? 'No fue posible eliminar el usuario.');
        this.isDeleting.set(false);
      }
    });
  }

  protected formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  }

  protected statusLabel(status: ParkingServiceStatus): string {
    return {
      HABILITADO: 'Habilitado',
      INHABILITADO: 'Inhabilitado',
      SIN_AUTORIZACION: 'Sin autorización vigente'
    }[status];
  }
}
