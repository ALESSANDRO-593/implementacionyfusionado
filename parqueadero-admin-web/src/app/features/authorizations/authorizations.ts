import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ParkingModality } from '../payments/models/parking-payment.model';
import { ParkingUser } from '../users/models/parking-user.model';
import { ParkingUsersService } from '../users/services/parking-users.service';
import { ParkingVehicle } from '../vehicles/models/parking-vehicle.model';
import { ParkingVehiclesService } from '../vehicles/services/parking-vehicles.service';
import { ParkingAuthorization, ParkingAuthorizationStatus } from './models/parking-authorization.model';
import { ParkingTicketsService } from './services/parking-tickets.service';

type StatusFilter = 'TODOS' | ParkingAuthorizationStatus;
type ModalityFilter = 'TODAS' | ParkingModality;

@Component({ selector: 'app-authorizations', templateUrl: './authorizations.html', styleUrl: './authorizations.scss' })
export class Authorizations implements OnInit {
  private readonly ticketsService = inject(ParkingTicketsService);
  private readonly usersService = inject(ParkingUsersService);
  private readonly vehiclesService = inject(ParkingVehiclesService);
  protected readonly authorizations = signal<ParkingAuthorization[]>([]);
  protected readonly users = signal<ParkingUser[]>([]);
  protected readonly vehicles = signal<ParkingVehicle[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<StatusFilter>('TODOS');
  protected readonly modalityFilter = signal<ModalityFilter>('TODAS');
  protected readonly ticketAuthorization = signal<ParkingAuthorization | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');

  protected readonly filteredAuthorizations = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('es');
    return this.authorizations().filter(ticket => {
      const user = this.userFor(ticket.parkingUserId);
      const vehicle = this.vehicleFor(ticket.vehicleId);
      return (!query || [ticket.code, user?.fullName ?? '', user?.identification ?? '', vehicle?.plate ?? '']
        .some(value => value.toLocaleLowerCase('es').includes(query)))
        && (this.statusFilter() === 'TODOS' || this.effectiveStatus(ticket) === this.statusFilter())
        && (this.modalityFilter() === 'TODAS' || ticket.modality === this.modalityFilter());
    });
  });

  ngOnInit(): void { this.loadData(); }
  protected loadData(): void {
    this.isLoading.set(true); this.loadError.set('');
    forkJoin({ tickets: this.ticketsService.list(), users: this.usersService.list(), vehicles: this.vehiclesService.list() }).subscribe({
      next: data => { this.authorizations.set(data.tickets); this.users.set(data.users); this.vehicles.set(data.vehicles); this.isLoading.set(false); },
      error: () => { this.loadError.set('No fue posible consultar el historial de tickets.'); this.isLoading.set(false); }
    });
  }
  protected updateSearch(event: Event): void { this.searchTerm.set((event.target as HTMLInputElement).value); }
  protected updateStatusFilter(event: Event): void { this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter); }
  protected updateModalityFilter(event: Event): void { this.modalityFilter.set((event.target as HTMLSelectElement).value as ModalityFilter); }
  protected userFor(id: number): ParkingUser | undefined { return this.users().find(item => item.id === id); }
  protected vehicleFor(id: number): ParkingVehicle | undefined { return this.vehicles().find(item => item.id === id); }
  protected viewTicket(ticket: ParkingAuthorization): void { this.ticketAuthorization.set(ticket); }
  protected closeTicket(): void { this.ticketAuthorization.set(null); }
  @HostListener('document:keydown.escape') protected closeOnEscape(): void { this.closeTicket(); }
  protected effectiveStatus(ticket: ParkingAuthorization): ParkingAuthorizationStatus {
    if (ticket.status !== 'VIGENTE') return ticket.status;
    const today = this.todayIso();
    return ticket.startDate <= today && ticket.endDate >= today ? 'VIGENTE' : 'VENCIDA';
  }
  protected statusLabel(ticket: ParkingAuthorization): string {
    return { VIGENTE: 'Vigente', VENCIDA: 'Vencida', BLOQUEADA: 'Bloqueada', ANULADA: 'Anulada' }[this.effectiveStatus(ticket)];
  }
  protected formatDate(date: string): string { return new Intl.DateTimeFormat('es-EC',{timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`)); }
  private todayIso(): string { const now=new Date(); return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10); }
}
