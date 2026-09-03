import { Component, computed, ElementRef, HostListener, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ParkingUser } from '../users/models/parking-user.model';
import { ParkingUsersService } from '../users/services/parking-users.service';
import { ParkingVehicle } from '../vehicles/models/parking-vehicle.model';
import { ParkingVehiclesService } from '../vehicles/services/parking-vehicles.service';
import { ParkingModality, ParkingModalityOption, ParkingPayment, ParkingPaymentStatus } from './models/parking-payment.model';
import { ParkingPaymentsService } from './services/parking-payments.service';

type ModalityFilter = 'TODAS' | ParkingModality;
type PaymentStatusFilter = 'TODOS' | ParkingPaymentStatus;

@Component({
  selector: 'app-payments',
  imports: [ReactiveFormsModule],
  templateUrl: './payments.html',
  styleUrl: './payments.scss'
})
export class Payments implements OnInit {
  @ViewChild('approvalDatePicker') private approvalDatePicker?: ElementRef<HTMLInputElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly usersService = inject(ParkingUsersService);
  private readonly vehiclesService = inject(ParkingVehiclesService);
  private readonly paymentsService = inject(ParkingPaymentsService);

  protected readonly parkingUsers = signal<ParkingUser[]>([]);
  protected readonly vehicles = signal<ParkingVehicle[]>([]);
  protected readonly modalities = signal<ParkingModalityOption[]>([]);
  protected readonly payments = signal<ParkingPayment[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly modalityFilter = signal<ModalityFilter>('TODAS');
  protected readonly statusFilter = signal<PaymentStatusFilter>('TODOS');
  protected readonly selectedUserId = signal<number | null>(null);
  protected readonly isModalOpen = signal(false);
  protected readonly feedback = signal('');
  protected readonly loadError = signal('');
  protected readonly mutationError = signal('');
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly pendingPayment = signal<ParkingPayment | null>(null);
  protected readonly decision = signal<'approve' | 'reject'>('approve');
  protected readonly approvalDateDisplay = signal('');

  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    parkingUserId: ['', Validators.required],
    modality: ['DIARIO' as ParkingModality, Validators.required],
    startDate: [this.todayIso(), Validators.required],
    vehicleId: ['', Validators.required]
  });
  protected readonly approvalForm = this.formBuilder.nonNullable.group({
    startDate: [this.todayIso(), Validators.required],
    reason: ['', [Validators.maxLength(300)]]
  });

  protected readonly availableUsers = computed(() => this.parkingUsers().filter(user => user.enabled && user.type === 'INVITADO'));
  protected readonly filteredPayments = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('es');
    const modality = this.modalityFilter();
    const status = this.statusFilter();
    return this.payments().filter(payment => {
      const user = this.userFor(payment.parkingUserId);
      const matchesQuery = !query || [
        user?.fullName ?? '', user?.identification ?? '', this.vehicleFor(payment.vehicleId)?.plate ?? ''
      ].some(value => value.toLocaleLowerCase('es').includes(query));
      return matchesQuery
        && (modality === 'TODAS' || payment.modality === modality)
        && (status === 'TODOS' || payment.status === status);
    });
  });
  protected readonly hasActiveFilters = computed(() =>
    this.searchTerm().trim() !== '' || this.modalityFilter() !== 'TODAS' || this.statusFilter() !== 'TODOS'
  );

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    forkJoin({
      users: this.usersService.list(),
      vehicles: this.vehiclesService.list(),
      modalities: this.paymentsService.catalogs(),
      payments: this.paymentsService.list()
    }).subscribe({
      next: data => {
        this.parkingUsers.set(data.users);
        this.vehicles.set(data.vehicles);
        this.modalities.set(data.modalities);
        this.payments.set(data.payments);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('No fue posible consultar las solicitudes de tickets.');
        this.isLoading.set(false);
      }
    });
  }

  protected updateSearch(event: Event): void { this.searchTerm.set((event.target as HTMLInputElement).value); }
  protected updateModalityFilter(event: Event): void { this.modalityFilter.set((event.target as HTMLSelectElement).value as ModalityFilter); }
  protected updateStatusFilter(event: Event): void { this.statusFilter.set((event.target as HTMLSelectElement).value as PaymentStatusFilter); }
  protected userFor(userId: number): ParkingUser | undefined { return this.parkingUsers().find(user => user.id === userId); }
  protected vehicleFor(vehicleId: number): ParkingVehicle | undefined { return this.vehicles().find(vehicle => vehicle.id === vehicleId); }

  protected availableVehicles(): ParkingVehicle[] {
    const userId = this.selectedUserId();
    return userId === null ? [] : this.vehicles().filter(vehicle => vehicle.active && vehicle.parkingUserId === userId);
  }

  protected openRegistration(): void {
    this.paymentForm.reset({
      parkingUserId: '', modality: 'DIARIO', startDate: this.todayIso(), vehicleId: ''
    });
    this.selectedUserId.set(null);
    this.mutationError.set('');
    this.isModalOpen.set(true);
  }

  protected closeRegistration(): void { if (!this.isSaving()) this.isModalOpen.set(false); }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.isSaving()) return;
    if (this.pendingPayment()) this.closeApproval();
    else if (this.isModalOpen()) this.closeRegistration();
  }

  protected openDecision(payment: ParkingPayment, decision: 'approve' | 'reject'): void {
    this.pendingPayment.set(payment);
    this.decision.set(decision);
    const startDate = payment.startDate || this.todayIso();
    this.approvalForm.reset({ startDate, reason: '' });
    this.approvalDateDisplay.set(this.formatDate(startDate));
    const reason = this.approvalForm.controls.reason;
    decision === 'reject' ? reason.addValidators(Validators.required) : reason.removeValidators(Validators.required);
    reason.updateValueAndValidity();
    this.mutationError.set('');
  }

  protected updateApprovalDate(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    const display = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
      .filter(Boolean).join('/');
    input.value = display;
    this.approvalDateDisplay.set(display);

    const control = this.approvalForm.controls.startDate;
    control.markAsTouched();
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
    if (!match) { control.setValue(''); control.setErrors({ dateFormat: true }); return; }

    const [, day, month, year] = match;
    const iso = `${year}-${month}-${day}`;
    const date = new Date(`${iso}T00:00:00Z`);
    const valid = !Number.isNaN(date.getTime())
      && date.getUTCFullYear() === Number(year)
      && date.getUTCMonth() + 1 === Number(month)
      && date.getUTCDate() === Number(day);
    control.setValue(valid ? iso : '');
    control.setErrors(valid ? null : { dateFormat: true });
  }

  protected selectApprovalDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;

    const control = this.approvalForm.controls.startDate;
    control.setValue(value);
    control.setErrors(null);
    control.markAsTouched();
    this.approvalDateDisplay.set(this.formatDate(value));
  }

  protected openApprovalDatePicker(): void {
    const picker = this.approvalDatePicker?.nativeElement;
    if (!picker) return;

    try {
      if (typeof picker.showPicker === 'function') picker.showPicker();
      else { picker.focus(); picker.click(); }
    } catch {
      picker.focus();
      picker.click();
    }
  }

  protected closeApproval(): void {
    if (!this.isSaving()) this.pendingPayment.set(null);
  }

  protected approvePendingPayment(): void {
    const payment = this.pendingPayment();
    if (!payment || this.approvalForm.invalid) return;
    this.isSaving.set(true);
    this.mutationError.set('');
    this.paymentsService.approve(payment.id, this.approvalForm.controls.startDate.value).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.pendingPayment.set(null);
        this.feedback.set('Solicitud aprobada y ticket generado correctamente.');
        this.loadData();
      },
      error: error => {
        this.isSaving.set(false);
        this.mutationError.set(error.error?.error ?? 'No fue posible aprobar la solicitud.');
      }
    });
  }

  protected rejectPendingPayment(): void {
    const payment = this.pendingPayment();
    if (!payment || this.approvalForm.controls.reason.invalid) { this.approvalForm.controls.reason.markAsTouched(); return; }
    this.isSaving.set(true); this.mutationError.set('');
    this.paymentsService.reject(payment.id, this.approvalForm.controls.reason.value.trim()).subscribe({
      next: () => { this.isSaving.set(false); this.pendingPayment.set(null); this.feedback.set('Solicitud rechazada correctamente.'); this.loadData(); },
      error: error => { this.isSaving.set(false); this.mutationError.set(error.error?.error ?? 'No fue posible rechazar la solicitud.'); }
    });
  }

  protected handleUserChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const userId = value ? Number(value) : null;
    this.selectedUserId.set(userId);
    const primary = userId === null ? undefined : this.vehicles().find(vehicle =>
      vehicle.active && vehicle.isPrimary && vehicle.parkingUserId === userId
    );
    this.paymentForm.controls.vehicleId.setValue(primary ? String(primary.id) : '');
    this.mutationError.set('');
  }

  protected amountFor(): number {
    const vehicle = this.vehicles().find(item => item.id === Number(this.paymentForm.controls.vehicleId.value));
    if (!vehicle) return 0;
    return this.modalities().find(option =>
      option.modality === this.paymentForm.controls.modality.value && option.vehicleType === vehicle.type
    )?.amount ?? 0;
  }

  protected calculatedEndDate(): string {
    const startDate = this.paymentForm.controls.startDate.value;
    if (!startDate) return '';
    return this.endDateFor(startDate, this.paymentForm.controls.modality.value);
  }

  protected approvalEndDate(): string {
    const payment = this.pendingPayment();
    const startDate = this.approvalForm.controls.startDate.value;
    return payment && startDate ? this.endDateFor(startDate, payment.modality) : '';
  }

  protected registerPayment(): void {
    if (this.paymentForm.invalid || this.amountFor() <= 0) {
      this.paymentForm.markAllAsTouched();
      if (this.amountFor() <= 0) this.mutationError.set('No existe una tarifa activa para la modalidad y el vehículo seleccionados.');
      return;
    }
    const values = this.paymentForm.getRawValue();
    this.isSaving.set(true);
    this.mutationError.set('');
    this.paymentsService.create({
      parkingUserId: Number(values.parkingUserId),
      vehicleId: Number(values.vehicleId),
      modality: values.modality as ParkingModality,
      startDate: values.startDate,
      method: 'EFECTIVO',
      reference: 'REGISTRO_ADMINISTRATIVO',
      status: 'APROBADO',
      issueAuthorization: true
    }).subscribe({
      next: response => {
        this.isSaving.set(false);
        this.feedback.set(response.authorizationId ? 'Ticket de invitado registrado correctamente.' : 'Solicitud registrada correctamente.');
        this.isModalOpen.set(false);
        this.loadData();
      },
      error: error => {
        this.mutationError.set(error.error?.error ?? 'No fue posible registrar el ticket.');
        this.isSaving.set(false);
      }
    });
  }

  protected isCurrent(payment: ParkingPayment): boolean {
    const today = this.todayIso();
    return payment.status === 'APROBADO' && payment.startDate <= today && payment.endDate >= today;
  }

  protected formatDate(date: string): string {
    if (!date) return '—';
    const [year, month, day] = date.slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : '—';
  }

  private todayIso(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }

  private endDateFor(startDate: string, modality: ParkingModality): string {
    if (modality === 'DIARIO') return startDate;
    const date = new Date(`${startDate}T00:00:00Z`);
    const requestedDay = date.getUTCDate();
    if (requestedDay === 1) return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(requestedDay, lastDay));
    return date.toISOString().slice(0, 10);
  }
}
