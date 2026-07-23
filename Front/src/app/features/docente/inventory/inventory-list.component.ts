import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';
import { InventorySyncService } from '../../../core/services/inventory-sync.service';

@Component({
  selector: 'app-docente-inventory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.css'
})
export class DocenteInventoryComponent implements OnInit, OnDestroy {
  assignedItems = signal<any[]>([]);
  mySpaces = signal<PhysicalSpace[]>([]);
  selectedSpaceId = signal<string>('');
  selectedJornadaCode = signal<string>('MATUTINA');
  selectedViewCode = signal<string>('');
  searchQuery = signal<string>('');

  showReportsModal = signal(false);
  selectedItemForReports = signal<any>(null);
  
  isLoading = signal(false);
  filterForm: FormGroup;

  private syncSub?: Subscription;
  private pollTimer?: any;

  constructor(
    private readonly fb: FormBuilder,
    private readonly spacesService: SpacesService,
    private readonly syncService: InventorySyncService
  ) {
    this.filterForm = this.fb.group({
      spaceId: [''],
      search: ['']
    });

    // Escuchar cambios reactivos en los filtros
    this.filterForm.valueChanges.subscribe((val) => {
      this.searchQuery.set((val.search || '').trim().toLowerCase());
    });

    // Cargar del servidor cuando cambia el espacio físico
    this.filterForm.get('spaceId')?.valueChanges.subscribe((spaceId) => {
      this.selectedSpaceId.set(spaceId || '');
      this.loadInventory();
    });
  }

  ngOnInit(): void {
    this.loadInventory();
    this.loadMySpaces();

    // 1. Escuchar eventos en tiempo real (BroadcastChannel & RxJS)
    this.syncSub = this.syncService.events$.subscribe((eventType) => {
      if (eventType === 'INVENTORY_CHANGED' || eventType === 'SPACES_CHANGED') {
        this.loadInventory(true);
      }
    });

    // 2. Polling silencioso cada 8 segundos para sincronización entre dispositivos
    this.pollTimer = setInterval(() => {
      this.loadInventory(true);
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.syncSub) this.syncSub.unsubscribe();
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  loadInventory(silent: boolean = false): void {
    if (!silent) this.isLoading.set(true);
    const spaceId = this.filterForm.get('spaceId')?.value || '';
    const filters = {
      spaceId,
      jornada: this.selectedJornadaCode()
    };

    this.spacesService.getAssignedInventory(filters).subscribe({
      next: (res: any[]) => {
        this.assignedItems.set(res || []);
        if (!silent) this.isLoading.set(false);
      },
      error: (err: any) => {
        if (!silent) {
          this.assignedItems.set([]);
          this.isLoading.set(false);
        }
      }
    });
  }

  loadMySpaces(): void {
    this.spacesService.getAllSpaces().subscribe({
      next: (res: PhysicalSpace[]) => {
        this.mySpaces.set(res || []);
      }
    });
  }

  setJornada(jornada: string): void {
    this.selectedJornadaCode.set(jornada);
    this.loadInventory();
  }

  resetFilters(): void {
    this.filterForm.reset({
      spaceId: '',
      search: ''
    });
    this.searchQuery.set('');
    this.selectedJornadaCode.set('MATUTINA');
    this.selectedViewCode.set('');
    this.loadInventory();
  }

  openReportsModal(item: any): void {
    this.selectedItemForReports.set(item);
    this.showReportsModal.set(true);
  }

  closeReportsModal(): void {
    this.showReportsModal.set(false);
    this.selectedItemForReports.set(null);
  }

  isItemInsumo(item: any): boolean {
    return this.getItemViewCode(item) === 'INSUMOS';
  }

  getItemViewCode(item: any): string {
    if (!item) return '';
    const code = item.inventoryView?.code || item.viewCode || item.subcategoria?.categoria?.baseView || item.subcategory?.category?.inventoryView?.code;
    const name = item.view || item.inventoryView?.name || item.subcategory?.category?.inventoryView?.name || '';
    if (code === 'BIENES_PUBLICOS' || name === 'Bienes Públicos') return 'BIENES_PUBLICOS';
    if (code === 'INSUMOS' || name === 'Insumos y Suministros' || name === 'Insumos') return 'INSUMOS';
    if (code === 'BIBLIOTECA' || name === 'Biblioteca') return 'BIBLIOTECA';

    const itemCode = item.codeValue || item.codigoYavirac || '';
    if (itemCode.startsWith('INS-')) return 'INSUMOS';
    if (itemCode.startsWith('BIB-')) return 'BIBLIOTECA';
    if (itemCode.startsWith('YAV-')) return 'BIENES_PUBLICOS';

    return code || '';
  }

  getItemViewName(item: any): string {
    const code = this.getItemViewCode(item);
    if (code === 'BIENES_PUBLICOS') return 'Bienes Públicos';
    if (code === 'INSUMOS') return 'Insumos y Suministros';
    if (code === 'BIBLIOTECA') return 'Biblioteca';
    return 'Bienes Públicos';
  }

  // Detección dinámica de vistas con ítems asociados para el docente en la jornada activa
  availableViews = computed(() => {
    const items = this.assignedItems();
    const hasBienes = items.some((i) => this.getItemViewCode(i) === 'BIENES_PUBLICOS');
    const hasInsumos = items.some((i) => this.getItemViewCode(i) === 'INSUMOS');
    const hasBiblioteca = items.some((i) => this.getItemViewCode(i) === 'BIBLIOTECA');
    return { hasBienes, hasInsumos, hasBiblioteca };
  });

  // Filtrado reactivo por vista seleccionada y por texto de búsqueda en tiempo real
  filteredAssignedItems = computed(() => {
    let list = this.assignedItems();
    const viewCode = this.selectedViewCode();
    const query = this.searchQuery();

    // 1. Filtrar por vista seleccionada (Bienes, Insumos, Biblioteca)
    if (viewCode) {
      list = list.filter((i) => this.getItemViewCode(i) === viewCode);
    }

    // 2. Filtrar por buscador de texto (Código, nombre del artículo, aula o categoría)
    if (query) {
      list = list.filter((item) => {
        const name = (item.name || item.dynamicValues?.['nombre'] || '').toLowerCase();
        const code = (item.codeValue || item.codigoYavirac || '').toLowerCase();
        const room = (item.roomNumber || item.space?.roomNumber || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        return name.includes(query) || code.includes(query) || room.includes(query) || cat.includes(query);
      });
    }

    return list;
  });

  formatJornada(jornada: string): string {
    if (!jornada) return '';
    if (jornada === 'MATUTINA') return 'Matutina';
    if (jornada === 'VESPERTINA') return 'Vespertina';
    if (jornada === 'NOCTURNA') return 'Nocturna';
    return jornada;
  }
}
