import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ParkingAuthorization } from '../authorizations/models/parking-authorization.model';
import { ParkingTicketsService } from '../authorizations/services/parking-tickets.service';
import { ParkingUser } from '../users/models/parking-user.model';
import { ParkingUsersService } from '../users/services/parking-users.service';
import { ParkingVehicle } from '../vehicles/models/parking-vehicle.model';
import { ParkingVehiclesService } from '../vehicles/services/parking-vehicles.service';
import { AccessMovement, ParkingAccessRecord, ParkingAccessResponse, ParkingEntryRequest } from './models/parking-access.model';
import { ParkingAccessService } from './services/parking-access.service';

@Component({
  selector: 'app-access-control',
  imports: [ReactiveFormsModule],
  templateUrl: './access-control.html',
  styleUrl: './access-control.scss'
})
export class AccessControl implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly accessService = inject(ParkingAccessService);
  private readonly ticketsService = inject(ParkingTicketsService);
  private readonly usersService = inject(ParkingUsersService);
  private readonly vehiclesService = inject(ParkingVehiclesService);

  protected readonly summary = signal<ParkingAccessResponse>({ total: 0, occupied: 0, available: 0, data: [] });
  protected readonly tickets = signal<ParkingAuthorization[]>([]);
  protected readonly users = signal<ParkingUser[]>([]);
  protected readonly vehicles = signal<ParkingVehicle[]>([]);
  protected readonly mode = signal<AccessMovement | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly feedback = signal('');
  protected readonly search = signal('');
  protected readonly ticketSearch = signal('');
  protected readonly ticketDropdownOpen = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    authorizationId: ['', Validators.required],
    useTemporary: [false],
    temporaryPlate: [''],
    temporaryVehicleType: ['AUTO' as 'AUTO' | 'MOTO']
  });

  protected readonly filtered = computed(() => {
    const query = this.search().toLowerCase().trim();
    return this.summary().data.filter(access => !query || [
      access.ticketCode,
      access.plate,
      this.userFor(access.parkingUserId)?.fullName ?? ''
    ].some(value => value.toLowerCase().includes(query)));
  });

  protected readonly insideTickets = computed(() => {
    const latest = new Map<number, ParkingAccessRecord>();
    for (const access of this.summary().data) {
      if (access.validationStatus === 'AUTORIZADO' && !latest.has(access.parkingUserId)) {
        latest.set(access.parkingUserId, access);
      }
    }
    return this.tickets().filter(ticket => {
      const access = latest.get(ticket.parkingUserId);
      return access?.movement === 'ENTRADA' && access.authorizationId === ticket.id;
    });
  });

  protected readonly validTickets = computed(() => {
    const today = this.today();
    const usersInside = new Set(this.insideTickets().map(ticket => ticket.parkingUserId));
    return this.tickets().filter(ticket => ticket.status === 'VIGENTE'
      && ticket.startDate <= today
      && ticket.endDate >= today
      && !usersInside.has(ticket.parkingUserId));
  });

  protected readonly selectableTickets = computed(() => {
    const available = this.mode() === 'ENTRADA' ? this.validTickets() : this.insideTickets();
    const query = this.normalizeSearch(this.ticketSearch());
    if (!query) return available;

    return available.filter(ticket => {
      const user = this.userFor(ticket.parkingUserId);
      const vehicle = this.vehicleFor(ticket.vehicleId);
      return [
        ticket.code,
        String(ticket.id),
        user?.fullName ?? '',
        user?.identification ?? '',
        vehicle?.plate ?? '',
        ...(user?.vehicles ?? [])
      ].some(value => this.normalizeSearch(value).includes(query));
    });
  });

  ngOnInit(): void { this.load(); }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.accessService.list(),
      tickets: this.ticketsService.list(),
      users: this.usersService.list(),
      vehicles: this.vehiclesService.list()
    }).subscribe({
      next: data => {
        this.summary.set(data.summary);
        this.tickets.set(data.tickets);
        this.users.set(data.users);
        this.vehicles.set(data.vehicles);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible consultar entradas y salidas.');
        this.loading.set(false);
      }
    });
  }

  protected open(mode: AccessMovement): void {
    this.mode.set(mode);
    this.ticketSearch.set('');
    this.ticketDropdownOpen.set(false);
    this.form.reset({
      authorizationId: '', useTemporary: false, temporaryPlate: '', temporaryVehicleType: 'AUTO'
    });
    this.error.set('');
  }

  protected close(): void { if (!this.saving()) this.mode.set(null); }

  protected save(): void {
    if (this.form.controls.authorizationId.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    const authorizationId = Number(values.authorizationId);
    if (this.mode() === 'ENTRADA' && values.useTemporary) {
      const plate = values.temporaryPlate.trim().toUpperCase();
      if (!/^[A-Z0-9-]{5,15}$/.test(plate)) {
        this.error.set('Ingrese una placa temporal válida.');
        return;
      }
    }

    this.saving.set(true);
    this.error.set('');
    const request = this.mode() === 'ENTRADA'
      ? this.accessService.entry(this.entryRequest(authorizationId))
      : this.accessService.exit(authorizationId);

    request.subscribe({
      next: () => {
        const movement = this.mode();
        this.saving.set(false);
        this.feedback.set(movement === 'ENTRADA' ? 'Entrada registrada.' : 'Salida registrada.');
        this.mode.set(null);
        this.load();
      },
      error: response => {
        this.saving.set(false);
        this.error.set(response.error?.error ?? 'No fue posible registrar el movimiento.');
      }
    });
  }

  protected userFor(id: number): ParkingUser | undefined { return this.users().find(user => user.id === id); }
  protected selectedTicket(): ParkingAuthorization | undefined {
    const id = Number(this.form.controls.authorizationId.value);
    return this.tickets().find(ticket => ticket.id === id);
  }
  protected vehicleFor(id: number): ParkingVehicle | undefined { return this.vehicles().find(vehicle => vehicle.id === id); }
  protected ticketPlate(ticket: ParkingAuthorization): string {
    return this.vehicleFor(ticket.vehicleId)?.plate
      ?? this.userFor(ticket.parkingUserId)?.vehicles[0]
      ?? 'Sin placa';
  }
  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected updateTicketSearch(event: Event): void {
    this.ticketSearch.set((event.target as HTMLInputElement).value);
    this.form.controls.authorizationId.setValue('');
    this.ticketDropdownOpen.set(true);
  }
  protected openTicketDropdown(): void {
    this.ticketDropdownOpen.set(true);
  }
  protected closeTicketDropdown(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement;
    if (!container.contains(event.relatedTarget as Node | null)) this.ticketDropdownOpen.set(false);
  }
  protected selectTicket(ticket: ParkingAuthorization): void {
    this.form.controls.authorizationId.setValue(String(ticket.id));
    this.ticketSearch.set(`${ticket.code} · ${this.userFor(ticket.parkingUserId)?.fullName ?? 'Usuario'} · ${this.ticketPlate(ticket)}`);
    this.ticketDropdownOpen.set(false);
  }
  protected format(value: string): string {
    return new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  private entryRequest(authorizationId: number): ParkingEntryRequest {
    const values = this.form.getRawValue();
    return {
      authorizationId,
      useTemporary: values.useTemporary,
      temporaryPlate: values.useTemporary ? values.temporaryPlate.trim().toUpperCase() : undefined,
      temporaryVehicleType: values.useTemporary ? values.temporaryVehicleType : undefined
    };
  }

  private today(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private normalizeSearch(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  }
}
