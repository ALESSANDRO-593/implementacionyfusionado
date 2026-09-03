import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PARKING_AUTHORIZATIONS_MOCK } from '../authorizations/data/parking-authorizations.mock';
import { ParkingAuthorization } from '../authorizations/models/parking-authorization.model';
import { PARKING_USERS_MOCK } from '../users/data/parking-users.mock';
import { ParkingUser } from '../users/models/parking-user.model';
import { PARKING_VEHICLES_MOCK } from '../vehicles/data/parking-vehicles.mock';
import { ParkingVehicle } from '../vehicles/models/parking-vehicle.model';
import { TEMPORARY_VEHICLE_CHANGES_MOCK } from './data/temporary-vehicle-changes.mock';
import { TemporaryVehicleChange } from './models/temporary-vehicle-change.model';

@Component({
  selector: 'app-temporary-vehicles',
  imports: [ReactiveFormsModule],
  templateUrl: './temporary-vehicles.html',
  styleUrl: './temporary-vehicles.scss'
})
export class TemporaryVehicles {
  private readonly formBuilder = inject(FormBuilder);

  protected readonly today = this.todayIso();
  protected readonly changes = signal<TemporaryVehicleChange[]>(
    structuredClone(TEMPORARY_VEHICLE_CHANGES_MOCK)
  );
  protected readonly searchTerm = signal('');
  protected readonly isModalOpen = signal(false);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');

  protected readonly temporaryVehicleForm = this.formBuilder.nonNullable.group({
    parkingUserId: ['', Validators.required],
    temporaryPlate: ['', [Validators.required, Validators.pattern(/^[A-Z0-9-]{5,15}$/)]],
    vehicleType: ['AUTO' as const, Validators.required],
    useDate: [this.today, Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(255)]]
  });

  protected readonly filteredChanges = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!query) return this.changes();

    return this.changes().filter(change => {
      const user = this.userFor(change.parkingUserId);
      const primaryVehicle = this.vehicleFor(change.primaryVehicleId);
      return [
        user?.fullName ?? '',
        user?.identification ?? '',
        primaryVehicle?.plate ?? '',
        change.temporaryPlate,
        change.reason
      ].some(value => value.toLocaleLowerCase('es').includes(query));
    });
  });

  protected eligibleUsers(): ParkingUser[] {
    const userIds = new Set(this.currentAuthorizations().map(item => item.parkingUserId));
    return PARKING_USERS_MOCK.filter(user => user.enabled && userIds.has(user.id));
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected openModal(): void {
    this.temporaryVehicleForm.reset({
      parkingUserId: '',
      temporaryPlate: '',
      vehicleType: 'AUTO',
      useDate: this.today,
      reason: ''
    });
    this.formError.set('');
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.isModalOpen()) this.closeModal();
  }

  protected normalizePlate(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 15);
    input.value = value;
    this.temporaryVehicleForm.controls.temporaryPlate.setValue(value);
    this.formError.set('');
  }

  protected selectedAuthorization(): ParkingAuthorization | undefined {
    const userId = Number(this.temporaryVehicleForm.controls.parkingUserId.value);
    const useDate = this.temporaryVehicleForm.controls.useDate.value;
    return PARKING_AUTHORIZATIONS_MOCK.find(authorization =>
      authorization.parkingUserId === userId
      && authorization.status === 'VIGENTE'
      && authorization.startDate <= useDate
      && authorization.endDate >= useDate
    );
  }

  protected selectedPrimaryVehicle(): ParkingVehicle | undefined {
    const authorization = this.selectedAuthorization();
    if (!authorization) return undefined;
    return this.vehicleFor(authorization.vehicleId)
      ?? PARKING_VEHICLES_MOCK.find(vehicle =>
        vehicle.parkingUserId === authorization.parkingUserId && vehicle.isPrimary && vehicle.active
      );
  }

  protected registerChange(): void {
    if (this.temporaryVehicleForm.invalid) {
      this.temporaryVehicleForm.markAllAsTouched();
      this.formError.set('Complete correctamente todos los campos requeridos.');
      return;
    }

    const authorization = this.selectedAuthorization();
    const primaryVehicle = this.selectedPrimaryVehicle();
    if (!authorization || !primaryVehicle) {
      this.formError.set('El usuario no tiene una autorización vigente para la fecha seleccionada.');
      return;
    }

    const { temporaryPlate, vehicleType, useDate, reason } = this.temporaryVehicleForm.getRawValue();
    if (temporaryPlate === primaryVehicle.plate) {
      this.formError.set('La placa temporal debe ser diferente a la del vehículo habitual.');
      return;
    }

    const alreadyRegistered = this.changes().some(change =>
      change.authorizationId === authorization.id
      && change.startDate <= useDate
      && change.endDate >= useDate
    );
    if (alreadyRegistered) {
      this.formError.set('Ya existe un cambio temporal para esta autorización en la fecha seleccionada.');
      return;
    }

    const nextId = Math.max(0, ...this.changes().map(change => change.id)) + 1;
    const newChange: TemporaryVehicleChange = {
      id: nextId,
      parkingUserId: authorization.parkingUserId,
      authorizationId: authorization.id,
      primaryVehicleId: primaryVehicle.id,
      temporaryPlate,
      vehicleType,
      startDate: useDate,
      endDate: useDate,
      reason: reason.trim(),
      registeredByPanelUserId: 1,
      registeredAt: new Date().toISOString()
    };

    this.changes.update(items => [newChange, ...items]);
    this.feedback.set(`Cambio temporal a la placa ${temporaryPlate} registrado correctamente.`);
    this.closeModal();
  }

  protected userFor(userId: number): ParkingUser | undefined {
    return PARKING_USERS_MOCK.find(user => user.id === userId);
  }

  protected vehicleFor(vehicleId: number): ParkingVehicle | undefined {
    return PARKING_VEHICLES_MOCK.find(vehicle => vehicle.id === vehicleId);
  }

  protected formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  }

  protected vehicleTypeLabel(type: 'AUTO' | 'MOTO'): string {
    return type === 'AUTO' ? 'Automóvil' : 'Motocicleta';
  }

  private currentAuthorizations(): ParkingAuthorization[] {
    return PARKING_AUTHORIZATIONS_MOCK.filter(authorization =>
      authorization.status === 'VIGENTE'
      && authorization.startDate <= this.today
      && authorization.endDate >= this.today
    );
  }

  private todayIso(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
  }
}
