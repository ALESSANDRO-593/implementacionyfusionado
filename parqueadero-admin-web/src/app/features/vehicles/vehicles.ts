import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ParkingUser } from '../users/models/parking-user.model';
import { ParkingUsersService } from '../users/services/parking-users.service';
import { ParkingVehicle, ParkingVehicleType } from './models/parking-vehicle.model';
import { ParkingVehiclesService } from './services/parking-vehicles.service';

type VehicleTypeFilter = 'TODOS' | ParkingVehicleType;

@Component({
  selector: 'app-vehicles',
  imports: [ReactiveFormsModule],
  templateUrl: './vehicles.html',
  styleUrl: './vehicles.scss'
})
export class Vehicles implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly parkingUsersService = inject(ParkingUsersService);
  private readonly parkingVehiclesService = inject(ParkingVehiclesService);

  protected readonly parkingUsers = signal<ParkingUser[]>([]);
  protected readonly vehicles = signal<ParkingVehicle[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly typeFilter = signal<VehicleTypeFilter>('TODOS');
  protected readonly isModalOpen = signal(false);
  protected readonly plateAlreadyExists = signal(false);
  protected readonly feedback = signal('');
  protected readonly loadError = signal('');
  protected readonly mutationError = signal('');
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly retiringVehicleId = signal<number | null>(null);

  protected readonly vehicleForm = this.formBuilder.nonNullable.group({
    parkingUserId: ['', Validators.required],
    plate: ['', [Validators.required, Validators.pattern(/^[A-Z0-9-]{5,15}$/)]],
    type: ['AUTO' as ParkingVehicleType, Validators.required]
  });

  protected readonly filteredVehicles = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('es');
    const type = this.typeFilter();
    return this.vehicles().filter(vehicle => {
      if (!vehicle.active || (type !== 'TODOS' && vehicle.type !== type)) return false;
      const user = this.userFor(vehicle.parkingUserId);
      return !query || [
        vehicle.plate,
        vehicle.brand,
        vehicle.model,
        vehicle.color,
        user?.fullName ?? '',
        user?.identification ?? ''
      ].some(value => value.toLocaleLowerCase('es').includes(query));
    });
  });

  protected readonly availableParkingUsers = computed(() =>
    this.parkingUsers().filter(user => user.enabled && user.type === 'INVITADO')
  );

  protected readonly hasActiveFilters = computed(() =>
    this.searchTerm().trim() !== '' || this.typeFilter() !== 'TODOS'
  );

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    forkJoin({
      users: this.parkingUsersService.list(),
      vehicles: this.parkingVehiclesService.list()
    }).subscribe({
      next: ({ users, vehicles }) => {
        this.parkingUsers.set(users);
        this.vehicles.set(vehicles);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('No fue posible consultar los vehículos.');
        this.isLoading.set(false);
      }
    });
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateTypeFilter(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value as VehicleTypeFilter);
  }

  protected userFor(userId: number): ParkingUser | undefined {
    return this.parkingUsers().find(user => user.id === userId);
  }

  protected openRegistration(): void {
    this.vehicleForm.reset({
      parkingUserId: '', plate: '', type: 'AUTO'
    });
    this.plateAlreadyExists.set(false);
    this.mutationError.set('');
    this.isModalOpen.set(true);
  }

  protected closeRegistration(): void {
    if (!this.isSaving()) this.isModalOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.isModalOpen()) this.closeRegistration();
  }

  protected normalizePlate(): void {
    const control = this.vehicleForm.controls.plate;
    control.setValue(control.value.toUpperCase().replace(/\s+/g, ''), { emitEvent: false });
    this.plateAlreadyExists.set(false);
    this.mutationError.set('');
  }

  protected registerVehicle(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    const values = this.vehicleForm.getRawValue();
    const selectedUser = this.parkingUsers().find(user => user.id === Number(values.parkingUserId));
    if (!selectedUser || selectedUser.type !== 'INVITADO') {
      this.mutationError.set('Los vehículos sólo pueden registrarse para usuarios invitados.');
      return;
    }
    const plate = values.plate.toUpperCase();
    if (this.vehicles().some(vehicle => vehicle.plate.toUpperCase() === plate)) {
      this.plateAlreadyExists.set(true);
      return;
    }

    this.isSaving.set(true);
    this.mutationError.set('');
    this.parkingVehiclesService.create({
      parkingUserId: Number(values.parkingUserId),
      plate,
      type: values.type as ParkingVehicleType
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.feedback.set(`Vehículo ${plate} registrado correctamente.`);
        this.isModalOpen.set(false);
        this.loadData();
      },
      error: error => {
        const message = error.error?.error ?? 'No fue posible registrar el vehículo.';
        this.plateAlreadyExists.set(String(message).toLocaleLowerCase('es').includes('placa'));
        this.mutationError.set(message);
        this.isSaving.set(false);
      }
    });
  }

  protected retireVehicle(vehicle: ParkingVehicle): void {
    this.retiringVehicleId.set(vehicle.id);
    this.loadError.set('');
    this.parkingVehiclesService.retire(vehicle.id).subscribe({
      next: () => {
        this.retiringVehicleId.set(null);
        this.feedback.set(`Vehículo ${vehicle.plate} retirado del servicio.`);
        this.loadData();
      },
      error: error => {
        this.retiringVehicleId.set(null);
        this.loadError.set(error.error?.error ?? 'No fue posible retirar el vehículo.');
      }
    });
  }
}
