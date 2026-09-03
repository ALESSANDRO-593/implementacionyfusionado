import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ParkingPayment } from '../payments/models/parking-payment.model';
import { ParkingPaymentsService } from '../payments/services/parking-payments.service';
import { ParkingSettingsService } from '../settings/services/parking-settings.service';
import { ParkingUser } from '../users/models/parking-user.model';
import { ParkingUsersService } from '../users/services/parking-users.service';
import { ParkingVehicle } from '../vehicles/models/parking-vehicle.model';
import { ParkingVehiclesService } from '../vehicles/services/parking-vehicles.service';

@Component({ selector: 'app-dashboard', imports: [RouterLink], templateUrl: './dashboard.html', styleUrl: './dashboard.scss' })
export class Dashboard implements OnInit {
  private readonly usersService = inject(ParkingUsersService);
  private readonly vehiclesService = inject(ParkingVehiclesService);
  private readonly ticketsService = inject(ParkingPaymentsService);
  private readonly settingsService = inject(ParkingSettingsService);
  protected readonly users = signal<ParkingUser[]>([]);
  protected readonly vehicles = signal<ParkingVehicle[]>([]);
  protected readonly tickets = signal<ParkingPayment[]>([]);
  protected readonly capacity = signal({ total: 0, occupied: 0, available: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly pendingTickets = computed(() => this.tickets().filter(ticket => ticket.status === 'PENDIENTE'));
  protected readonly guestCount = computed(() => this.users().filter(user => user.type === 'INVITADO').length);
  ngOnInit(): void { this.load(); }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ users: this.usersService.list(), vehicles: this.vehiclesService.list(), tickets: this.ticketsService.list(), capacity: this.settingsService.getCapacity() }).subscribe({
      next: data => { this.users.set(data.users); this.vehicles.set(data.vehicles); this.tickets.set(data.tickets); this.capacity.set(data.capacity); this.loading.set(false); },
      error: () => { this.error.set('No fue posible cargar el resumen del parqueadero.'); this.loading.set(false); }
    });
  }
  protected userFor(id: number): ParkingUser | undefined { return this.users().find(user => user.id === id); }
}
