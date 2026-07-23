import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';
import { InventorySyncService } from '../../../core/services/inventory-sync.service';

@Component({
  selector: 'app-docente-spaces',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spaces-list.component.html',
  styleUrl: './spaces-list.component.css'
})
export class DocenteSpacesListComponent implements OnInit, OnDestroy {
  spaces = signal<PhysicalSpace[]>([]);
  isLoading = signal(false);
  
  // Detalle del Espacio Seleccionado
  selectedSpace = signal<PhysicalSpace | null>(null);
  selectedJornada = signal<string>('');
  selectedViewCode = signal<string>('');
  spaceInventory = signal<any[]>([]);
  inventoryLoading = signal(false);

  // Modal para Ver Detalle de Novedades del Artículo
  showReportsModal = signal(false);
  selectedItemForReports = signal<any | null>(null);

  private syncSub?: Subscription;
  private pollTimer?: any;

  constructor(
    private readonly spacesService: SpacesService,
    private readonly syncService: InventorySyncService
  ) {}

  ngOnInit(): void {
    this.loadMySpaces();

    // 1. Escuchar sincronización en tiempo real
    this.syncSub = this.syncService.events$.subscribe((type) => {
      if (type === 'INVENTORY_CHANGED' || type === 'SPACES_CHANGED' || type === 'INCIDENTS_CHANGED') {
        this.loadMySpaces(true);
        const space = this.selectedSpace();
        const jornada = this.selectedJornada();
        if (space && jornada) {
          this.loadSpaceInventory(space.id, jornada, true);
        }
      }
    });

    // 2. Polling silencioso cada 8 segundos
    this.pollTimer = setInterval(() => {
      const space = this.selectedSpace();
      const jornada = this.selectedJornada();
      if (space && jornada) {
        this.loadSpaceInventory(space.id, jornada, true);
      }
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.syncSub) this.syncSub.unsubscribe();
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  loadMySpaces(silent: boolean = false): void {
    if (!silent) this.isLoading.set(true);
    this.spacesService.getAllSpaces().subscribe({
      next: (res: PhysicalSpace[]) => {
        this.spaces.set(res);
        if (!silent) this.isLoading.set(false);
      },
      error: (err: any) => {
        if (!silent) this.isLoading.set(false);
      }
    });
  }

  selectSpace(space: PhysicalSpace): void {
    this.selectedSpace.set(space);
    this.selectedViewCode.set('');
    // Seleccionar la primera jornada disponible del espacio por defecto
    if (space.jornadas && space.jornadas.length > 0) {
      this.selectedJornada.set(space.jornadas[0]);
      this.loadSpaceInventory(space.id, space.jornadas[0]);
    } else {
      this.selectedJornada.set('');
      this.spaceInventory.set([]);
    }
  }

  changeJornada(jornada: string): void {
    const space = this.selectedSpace();
    if (!space) return;
    this.selectedJornada.set(jornada);
    this.loadSpaceInventory(space.id, jornada);
  }

  updateSelectedView(code: string): void {
    this.selectedViewCode.set(code);
  }

  loadSpaceInventory(spaceId: string, jornada: string, silent: boolean = false): void {
    if (!silent) this.inventoryLoading.set(true);
    this.spacesService.getInventoryByShift(spaceId, jornada).subscribe({
      next: (res: any[]) => {
        this.spaceInventory.set(res || []);
        if (!silent) this.inventoryLoading.set(false);
      },
      error: (err: any) => {
        if (!silent) this.inventoryLoading.set(false);
      }
    });
  }

  // Filtrado de inventario en aula por las 3 Vistas
  filteredSpaceInventory = computed(() => {
    const list = this.spaceInventory();
    const viewCode = this.selectedViewCode();
    if (!viewCode) return list;

    return list.filter((row) => {
      const code = row.inventoryView?.code || row.viewCode || row.subcategoria?.categoria?.baseView;
      const viewName = row.view || row.inventoryView?.name || '';

      if (viewCode === 'BIENES_PUBLICOS' && (code === 'BIENES_PUBLICOS' || viewName === 'Bienes Públicos')) return true;
      if (viewCode === 'INSUMOS' && (code === 'INSUMOS' || viewName === 'Insumos y Suministros')) return true;
      if (viewCode === 'BIBLIOTECA' && (code === 'BIBLIOTECA' || viewName === 'Biblioteca')) return true;
      return code === viewCode;
    });
  });

  // Detección dinámica de vistas con artículos asociados en el aula seleccionada
  availableViews = computed(() => {
    const list = this.spaceInventory();
    const hasBienes = list.some((row) => {
      const code = row.inventoryView?.code || row.viewCode || row.subcategoria?.categoria?.baseView;
      const viewName = row.view || row.inventoryView?.name || '';
      return code === 'BIENES_PUBLICOS' || viewName === 'Bienes Públicos';
    });
    const hasInsumos = list.some((row) => {
      const code = row.inventoryView?.code || row.viewCode || row.subcategoria?.categoria?.baseView;
      const viewName = row.view || row.inventoryView?.name || '';
      return code === 'INSUMOS' || viewName === 'Insumos y Suministros';
    });
    const hasBiblioteca = list.some((row) => {
      const code = row.inventoryView?.code || row.viewCode || row.subcategoria?.categoria?.baseView;
      const viewName = row.view || row.inventoryView?.name || '';
      return code === 'BIBLIOTECA' || viewName === 'Biblioteca';
    });
    return { hasBienes, hasInsumos, hasBiblioteca };
  });


  isItemInsumo(row: any): boolean {
    if (!row) return false;
    const code = row.inventoryView?.code || row.viewCode || row.subcategoria?.categoria?.baseView;
    const viewName = row.view || row.inventoryView?.name || '';
    return code === 'INSUMOS' || viewName === 'Insumos y Suministros';
  }

  getItemViewName(row: any): string {
    if (!row) return 'General';
    return row.inventoryView?.name || row.view || 'General';
  }

  openReportsModal(row: any): void {
    this.selectedItemForReports.set(row);
    this.showReportsModal.set(true);
  }

  closeReportsModal(): void {
    this.showReportsModal.set(false);
    this.selectedItemForReports.set(null);
  }

  closeDetails(): void {
    this.selectedSpace.set(null);
    this.spaceInventory.set([]);
    this.selectedViewCode.set('');
  }

  formatType(type: string): string {
    if (type === 'AULA') return 'Aula';
    if (type === 'LABORATORIO') return 'Laboratorio';
    if (type === 'TALLER') return 'Taller';
    if (type === 'OFICINA') return 'Oficina';
    if (type === 'BODEGA') return 'Bodega';
    return type;
  }
}
