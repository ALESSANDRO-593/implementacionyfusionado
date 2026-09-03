import { Component, computed, input, model } from '@angular/core';

/**
 * Paginación reutilizable de las tablas del panel.
 * `pagina` es de doble vía: el componente padre solo aporta el total y el
 * tamaño de página, y recorta su lista con `desde()` / `hasta()`.
 */
@Component({
  selector: 'app-paginator',
  standalone: true,
  templateUrl: './paginator.html',
})
export class Paginator {
  /** Total de elementos (ya filtrados). */
  total = input.required<number>();
  porPagina = input<number>(10);
  /** Página actual, empezando en 1. */
  pagina = model<number>(1);

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));
  /** Índice del primer elemento mostrado (base 1); 0 si no hay nada. */
  primero = computed(() => (this.total() === 0 ? 0 : (this.pagina() - 1) * this.porPagina() + 1));
  ultimo = computed(() => Math.min(this.pagina() * this.porPagina(), this.total()));

  /** Números de página a dibujar, con ventana de 5 alrededor de la actual. */
  paginas = computed<number[]>(() => {
    const tp = this.totalPaginas();
    const actual = Math.min(this.pagina(), tp);
    const inicio = Math.max(1, Math.min(actual - 2, tp - 4));
    const fin = Math.min(tp, inicio + 4);
    const out: number[] = [];
    for (let i = inicio; i <= fin; i++) out.push(i);
    return out;
  });

  ir(p: number) {
    const destino = Math.min(Math.max(1, p), this.totalPaginas());
    if (destino !== this.pagina()) this.pagina.set(destino);
  }
}
