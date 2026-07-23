import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IncidentsService, IncidentReport } from '../../../core/services/incidents.service';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';
import { PeriodsService } from '../../../core/services/periods.service';

@Component({
  selector: 'app-docente-incidents',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './incidents-list.component.html',
  styleUrl: './incidents-list.component.css'
})
export class DocenteIncidentsComponent implements OnInit {
  incidents = signal<IncidentReport[]>([]);
  mySpaces = signal<PhysicalSpace[]>([]);
  periods = signal<any[]>([]);
  
  // Señal reactiva para vincular la reevaluación de jornadas
  selectedSpaceId = signal<string>('');
  
  // Bienes del espacio en jornada seleccionada
  availableItems = signal<any[]>([]);
  selectedItemIds = signal<string[]>([]);
  selectedItemQuantities = signal<Record<string, number>>({});

  // Filtros interactivos en modal de reporte
  filterViewCode = signal<string>('');
  searchQuery = signal<string>('');
  filterCategory = signal<string>('');
  filterSubcategory = signal<string>('');
  isLoading = signal(false);
  modalLoading = signal(false);
  itemsLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modales
  showCreateModal = signal(false);
  showDetailModal = signal(false);
  selectedIncident = signal<IncidentReport | null>(null);

  // Formularios
  incidentForm: FormGroup;
  filterForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly incidentsService: IncidentsService,
    private readonly spacesService: SpacesService,
    private readonly periodsService: PeriodsService
  ) {
    this.filterForm = this.fb.group({
      status: [''],
      academicPeriodId: ['']
    });

    // Filtros reactivos instantáneos
    this.filterForm.valueChanges.subscribe(() => {
      this.loadMyIncidents();
    });

    this.incidentForm = this.fb.group({
      spaceId: ['', [Validators.required]],
      jornada: ['', [Validators.required]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      estadoFisico: ['REGULAR', [Validators.required]]
    });

    // Escuchar cambios de aula origen para limpiar jornada
    this.incidentForm.get('spaceId')?.valueChanges.subscribe((val) => {
      this.selectedSpaceId.set(val || '');
      this.incidentForm.patchValue({ jornada: '' }, { emitEvent: false });
      this.availableItems.set([]);
      this.selectedItemIds.set([]);
    });

    // Escuchar cambios de jornada para cargar los bienes
    this.incidentForm.get('jornada')?.valueChanges.subscribe((jornada) => {
      const spaceId = this.incidentForm.value.spaceId;
      if (spaceId && jornada) {
        this.loadSpaceItems(spaceId, jornada);
      } else {
        this.availableItems.set([]);
        this.selectedItemIds.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.loadMyIncidents();
    this.loadMySpaces();
    this.loadPeriods();
  }

  loadPeriods(): void {
    this.periodsService.getAllPeriods().subscribe({
      next: (res: any[]) => {
        this.periods.set(res);
      }
    });
  }

  applyFilters(): void {
    this.loadMyIncidents();
  }

  resetFilters(): void {
    this.filterForm.reset({
      status: '',
      academicPeriodId: ''
    });
  }

  loadMyIncidents(): void {
    this.isLoading.set(true);
    const filters = this.filterForm.value;
    this.incidentsService.getAllIncidents(filters).subscribe({
      next: (res: IncidentReport[]) => {
        this.incidents.set(res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.isLoading.set(false);
      }
    });
  }

  loadMySpaces(): void {
    this.spacesService.getAllSpaces().subscribe({
      next: (res: PhysicalSpace[]) => {
        this.mySpaces.set(res);
      }
    });
  }

  loadSpaceItems(spaceId: string, jornada: string): void {
    this.itemsLoading.set(true);
    this.selectedItemIds.set([]);
    this.selectedItemQuantities.set({});
    this.filterViewCode.set('');
    this.searchQuery.set('');
    this.filterCategory.set('');
    this.filterSubcategory.set('');

    this.spacesService.getInventoryByShift(spaceId, jornada).subscribe({
      next: (res: any[]) => {
        this.availableItems.set(res || []);
        this.itemsLoading.set(false);
      },
      error: (err: any) => {
        this.availableItems.set([]);
        this.itemsLoading.set(false);
      }
    });
  }

  // Filtrar las jornadas disponibles para el aula seleccionada
  availableJornadas = computed(() => {
    const spaceId = this.selectedSpaceId();
    if (!spaceId) return [];
    const space = this.mySpaces().find((s) => s.id === spaceId);
    return space?.jornadas || [];
  });

  // Helper para saber si un ítem es Insumo
  isItemInsumo(item: any): boolean {
    if (!item) return false;
    const code = item.inventoryView?.code || item.viewCode || item.subcategoria?.categoria?.baseView;
    const viewName = item.view || item.inventoryView?.name || '';
    return code === 'INSUMOS' || viewName === 'Insumos y Suministros';
  }

  // Helper para obtener nombre de la vista
  getItemViewName(item: any): string {
    if (!item) return 'General';
    return item.inventoryView?.name || item.view || 'General';
  }

  // Categorías filtradas basadas en los ítems asignados al espacio
  filteredCategories = computed(() => {
    const items = this.availableItems();
    const viewCode = this.filterViewCode();
    const map = new Map<string, { id: string; nombre: string }>();

    for (const item of items) {
      const catId = item.categoryId || item.subcategory?.categoryId || item.subcategory?.category?.id || item.subcategoria?.categoria?.id || (typeof item.category === 'string' ? item.category : null);
      const catName = typeof item.category === 'string' ? item.category : item.subcategory?.category?.name || item.subcategoria?.categoria?.nombre || 'Categoría';
      const code = item.inventoryView?.code || item.viewCode || item.subcategoria?.categoria?.baseView;
      const viewName = item.view || item.inventoryView?.name || '';

      if (catId && catName) {
        let matchesView = !viewCode;
        if (viewCode === 'BIENES_PUBLICOS' && (code === 'BIENES_PUBLICOS' || viewName === 'Bienes Públicos')) matchesView = true;
        else if (viewCode === 'INSUMOS' && (code === 'INSUMOS' || viewName === 'Insumos y Suministros')) matchesView = true;
        else if (viewCode === 'BIBLIOTECA' && (code === 'BIBLIOTECA' || viewName === 'Biblioteca')) matchesView = true;

        if (matchesView) {
          map.set(catId, { id: catId, nombre: catName });
        }
      }
    }
    return Array.from(map.values());
  });

  // Subcategorías filtradas basadas en los ítems asignados
  filteredSubcategories = computed(() => {
    const items = this.availableItems();
    const catId = this.filterCategory();
    const map = new Map<string, { id: string; nombre: string }>();

    for (const item of items) {
      const subId = item.subcategoryId || item.subcategory?.id || item.subcategoria?.id || (typeof item.subcategory === 'string' ? item.subcategory : null);
      const subName = typeof item.subcategory === 'string' ? item.subcategory : item.subcategory?.name || item.subcategoria?.nombre || 'Subcategoría';
      const itemCatId = item.categoryId || item.subcategory?.categoryId || item.subcategory?.category?.id || item.subcategoria?.categoria?.id || (typeof item.category === 'string' ? item.category : null);

      if (subId && subName) {
        if (!catId || itemCatId === catId) {
          map.set(subId, { id: subId, nombre: subName });
        }
      }
    }
    return Array.from(map.values());
  });

  // Ítems elegibles filtrados por Vista y Búsqueda por texto
  filteredAvailableItems = computed(() => {
    const list = this.availableItems();
    const viewCode = this.filterViewCode();
    const q = this.searchQuery().toLowerCase().trim();

    return list.filter((item) => {
      // 1. Vista
      if (viewCode) {
        const code = item.inventoryView?.code || item.viewCode || item.subcategoria?.categoria?.baseView;
        const viewName = item.view || item.inventoryView?.name || '';

        let matchesView = false;
        if (viewCode === 'BIENES_PUBLICOS' && (code === 'BIENES_PUBLICOS' || viewName === 'Bienes Públicos')) matchesView = true;
        else if (viewCode === 'INSUMOS' && (code === 'INSUMOS' || viewName === 'Insumos y Suministros')) matchesView = true;
        else if (viewCode === 'BIBLIOTECA' && (code === 'BIBLIOTECA' || viewName === 'Biblioteca')) matchesView = true;
        else if (code === viewCode) matchesView = true;

        if (!matchesView) return false;
      }

      // 2. Búsqueda por texto (código, nombre, subcategoría, categoría)
      if (q) {
        const code = (item.codeValue || item.codigoYavirac || '').toLowerCase();
        const name = (item.name || item.nombre || '').toLowerCase();
        const subName = (typeof item.subcategory === 'string' ? item.subcategory : item.subcategory?.name || item.subcategoria?.nombre || '').toLowerCase();
        const catName = (typeof item.category === 'string' ? item.category : item.subcategory?.category?.name || item.subcategoria?.categoria?.nombre || '').toLowerCase();
        const matches = code.includes(q) || name.includes(q) || subName.includes(q) || catName.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  });


  // Estado de selección masiva en visibles
  areAllVisibleSelected = computed(() => {
    const visible = this.filteredAvailableItems();
    if (visible.length === 0) return false;
    const selected = new Set(this.selectedItemIds());
    return visible.every((item) => selected.has(item.id));
  });

  toggleSelectAllVisible(): void {
    const visible = this.filteredAvailableItems();
    if (visible.length === 0) return;

    const allSelected = this.areAllVisibleSelected();
    const currentSelected = new Set(this.selectedItemIds());
    const qtyMap = { ...this.selectedItemQuantities() };

    if (allSelected) {
      visible.forEach((item) => {
        currentSelected.delete(item.id);
        delete qtyMap[item.id];
      });
    } else {
      visible.forEach((item) => {
        currentSelected.add(item.id);
        if (!qtyMap[item.id]) {
          qtyMap[item.id] = 1;
        }
      });
    }

    this.selectedItemIds.set(Array.from(currentSelected));
    this.selectedItemQuantities.set(qtyMap);
  }

  updateFilterView(viewCode: string): void {
    this.filterViewCode.set(viewCode);
    this.filterCategory.set('');
    this.filterSubcategory.set('');
  }

  updateFilterCategory(catId: string): void {
    this.filterCategory.set(catId);
    this.filterSubcategory.set('');
  }

  updateFilterSubcategory(subId: string): void {
    this.filterSubcategory.set(subId);
  }

  updateSearchQuery(q: string): void {
    this.searchQuery.set(q);
  }

  hasActiveReport(item: any): boolean {
    if (!item) return false;
    const isInsumo = this.isItemInsumo(item);
    if (!isInsumo) {
      return (item.estadoFisico && item.estadoFisico !== 'BUENO') || (item.reportesActivos && item.reportesActivos.length > 0);
    }
    const maxReportable = item.cantidadBuenEstado !== undefined ? item.cantidadBuenEstado : item.cantidad;
    return maxReportable <= 0;
  }

  getMaxReportableQuantity(item: any): number {
    if (!item) return 1;
    if (!this.isItemInsumo(item)) return 1;
    return item.cantidadBuenEstado !== undefined ? item.cantidadBuenEstado : item.cantidad || 1;
  }

  toggleItemSelection(itemId: string): void {
    const item = this.availableItems().find(i => i.id === itemId);
    if (item && this.hasActiveReport(item)) {
      const isInsumo = this.isItemInsumo(item);
      if (!isInsumo) {
        this.errorMessage.set(`El artículo '${item.name || item.codeValue}' ya cuenta con un reporte de novedad activo.`);
      } else {
        this.errorMessage.set(`El artículo '${item.name || item.codeValue}' no tiene unidades en buen estado disponibles para reportar.`);
      }
      return;
    }

    const current = [...this.selectedItemIds()];
    const index = current.indexOf(itemId);
    const qtyMap = { ...this.selectedItemQuantities() };

    if (index > -1) {
      current.splice(index, 1);
      delete qtyMap[itemId];
    } else {
      current.push(itemId);
      qtyMap[itemId] = 1;
    }
    this.selectedItemIds.set(current);
    this.selectedItemQuantities.set(qtyMap);
    this.errorMessage.set(null);
  }

  getItemQuantity(itemId: string): number {
    return this.selectedItemQuantities()[itemId] || 1;
  }

  setItemQuantity(itemId: string, qty: number, maxQty: number): void {
    let validQty = isNaN(qty) || qty < 1 ? 1 : qty;
    if (validQty > maxQty) validQty = maxQty;
    const qtyMap = { ...this.selectedItemQuantities(), [itemId]: validQty };
    this.selectedItemQuantities.set(qtyMap);
  }


  preventInvalidQuantityKeys(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) {
      event.preventDefault();
    }
  }

  openCreateModal(): void {
    this.selectedItemIds.set([]);
    this.availableItems.set([]);
    this.incidentForm.reset({
      spaceId: '',
      jornada: '',
      description: '',
      estadoFisico: 'REGULAR'
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  openDetailModal(incident: IncidentReport): void {
    this.selectedIncident.set(incident);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
  }

  onSubmitIncident(): void {
    if (this.incidentForm.invalid) return;
    if (this.selectedItemIds().length === 0) {
      this.errorMessage.set('Debes seleccionar al menos un artículo afectado.');
      return;
    }

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const val = this.incidentForm.value;
    const itemsPayload = this.selectedItemIds().map((id) => ({
      itemId: id,
      cantidadAfectada: this.getItemQuantity(id)
    }));

    const payload = {
      spaceId: val.spaceId,
      jornada: val.jornada,
      description: val.description.trim(),
      itemIds: this.selectedItemIds(),
      itemsPayload,
      estadoFisico: val.estadoFisico
    };

    this.incidentsService.createIncident(payload).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Reporte de novedad enviado correctamente.');
        setTimeout(() => {
          this.closeCreateModal();
          this.loadMyIncidents();
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al procesar el reporte de novedad.');
      }
    });
  }

  formatStatus(status: string): string {
    if (status === 'PENDIENTE') return 'Pendiente';
    if (status === 'REVISADO') return 'Revisado';
    if (status === 'RESUELTO') return 'Resuelto';
    return status;
  }

  formatJornada(jornada: string): string {
    if (jornada === 'MATUTINA') return 'Matutina';
    if (jornada === 'VESPERTINA') return 'Vespertina';
    if (jornada === 'NOCTURNA') return 'Nocturna';
    return jornada;
  }
}
