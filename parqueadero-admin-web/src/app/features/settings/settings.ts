import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ParkingTariff } from './models/parking-tariff.model';
import { ParkingCapacity, ParkingSettingsService } from './services/parking-settings.service';

type TariffEditorMode = 'create' | 'edit';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly settingsService = inject(ParkingSettingsService);

  protected readonly tariffs = signal<ParkingTariff[]>([]);
  protected readonly selectedTariff = signal<ParkingTariff | null>(null);
  protected readonly editorMode = signal<TariffEditorMode | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly loadError = signal('');
  protected readonly mutationError = signal('');
  protected readonly feedback = signal('');
  protected readonly capacity = signal<ParkingCapacity | null>(null);
  protected readonly capacityError = signal('');
  protected readonly isSavingCapacity = signal(false);

  protected readonly tariffForm = this.formBuilder.nonNullable.group({
    modality: ['DIARIO' as ParkingTariff['modality'], Validators.required],
    vehicleType: ['AUTO' as ParkingTariff['vehicleType'], Validators.required],
    amount: [0, [Validators.required, Validators.min(0), Validators.max(99_999_999.99)]],
    active: [true, Validators.required]
  });
  protected readonly capacityForm = this.formBuilder.nonNullable.group({ total: [100, [Validators.required, Validators.min(1), Validators.max(100000)]] });

  ngOnInit(): void { this.loadTariffs(); this.loadCapacity(); }

  protected loadCapacity(): void {
    this.capacityError.set('');
    this.settingsService.getCapacity().subscribe({
      next: capacity => { this.capacity.set(capacity); this.capacityForm.controls.total.setValue(capacity.total); },
      error: () => this.capacityError.set('No fue posible consultar la capacidad del parqueadero.')
    });
  }

  protected saveCapacity(): void {
    if (this.capacityForm.invalid) { this.capacityForm.markAllAsTouched(); return; }
    const total=this.capacityForm.controls.total.value;
    if (total < (this.capacity()?.occupied ?? 0)) { this.capacityError.set('La capacidad no puede ser menor que los espacios actualmente ocupados.'); return; }
    this.isSavingCapacity.set(true); this.capacityError.set('');
    this.settingsService.updateCapacity(total).subscribe({
      next:()=>{this.isSavingCapacity.set(false);this.feedback.set('Capacidad actualizada correctamente.');this.loadCapacity();},
      error:error=>{this.isSavingCapacity.set(false);this.capacityError.set(error.error?.error??'No fue posible actualizar la capacidad.');}
    });
  }

  protected loadTariffs(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    this.settingsService.listTariffs().subscribe({
      next: tariffs => { this.tariffs.set(tariffs); this.isLoading.set(false); },
      error: () => {
        this.loadError.set('No fue posible consultar las tarifas.');
        this.isLoading.set(false);
      }
    });
  }

  protected editTariff(tariff: ParkingTariff): void {
    this.selectedTariff.set(tariff);
    this.editorMode.set('edit');
    this.tariffForm.reset({ modality: tariff.modality, vehicleType: tariff.vehicleType, amount: tariff.amount, active: tariff.active });
    this.mutationError.set('');
  }

  protected createTariff(): void {
    const combinations: Array<[ParkingTariff['modality'], ParkingTariff['vehicleType']]> = [
      ['DIARIO', 'AUTO'], ['DIARIO', 'MOTO'], ['MENSUAL', 'AUTO'], ['MENSUAL', 'MOTO']
    ];
    const available = combinations.find(([modality, vehicleType]) => !this.combinationExists(modality, vehicleType));
    this.selectedTariff.set(null);
    this.editorMode.set('create');
    this.tariffForm.reset({ modality: available?.[0] ?? 'DIARIO', vehicleType: available?.[1] ?? 'AUTO', amount: 0, active: true });
    this.mutationError.set(this.allCombinationsConfigured()
      ? 'Todas las combinaciones ya están configuradas. Utilice “Editar tarifa” para cambiar sus valores.'
      : '');
  }

  protected closeEditor(): void {
    if (!this.isSaving()) {
      this.selectedTariff.set(null);
      this.editorMode.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void { if (this.editorMode()) this.closeEditor(); }

  protected saveTariff(): void {
    const mode = this.editorMode();
    const tariff = this.selectedTariff();
    if (!mode || this.tariffForm.invalid || (mode === 'edit' && !tariff)) {
      this.tariffForm.markAllAsTouched();
      return;
    }
    const values = this.tariffForm.getRawValue();
    if (values.active && values.amount <= 0) {
      this.mutationError.set('Una tarifa activa debe tener un precio mayor a cero.');
      return;
    }
    if (mode === 'create' && this.combinationExists(values.modality, values.vehicleType)) {
      this.mutationError.set('Ya existe una tarifa para esa modalidad y tipo de vehículo. Puede editarla desde la tarjeta correspondiente.');
      return;
    }
    this.isSaving.set(true);
    this.mutationError.set('');
    const request = mode === 'create'
      ? this.settingsService.createTariff({ modality: values.modality, vehicleType: values.vehicleType, amount: values.amount, active: values.active })
      : this.settingsService.updateTariff(tariff!.id, values.amount, values.active);
    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeEditor();
        this.feedback.set(mode === 'create' ? 'Tarifa creada correctamente.' : 'Tarifa actualizada correctamente.');
        this.loadTariffs();
      },
      error: error => {
        this.mutationError.set(error.error?.error ?? 'No fue posible actualizar la tarifa.');
        this.isSaving.set(false);
      }
    });
  }

  protected modalityLabel(value: ParkingTariff['modality']): string { return value === 'DIARIO' ? 'Diaria' : 'Mensual'; }
  protected vehicleLabel(value: ParkingTariff['vehicleType']): string { return value === 'AUTO' ? 'Automóvil' : 'Motocicleta'; }
  protected combinationExists(modality: ParkingTariff['modality'], vehicleType: ParkingTariff['vehicleType']): boolean {
    return this.tariffs().some(tariff => tariff.modality === modality && tariff.vehicleType === vehicleType);
  }
  protected allCombinationsConfigured(): boolean { return this.tariffs().length >= 4; }
}
