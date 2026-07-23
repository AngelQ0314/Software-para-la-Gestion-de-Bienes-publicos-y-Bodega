import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RequestsService, InventoryRequest } from '../../../core/services/requests.service';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';
import { InventoryService } from '../../admin/inventory/services/inventory.service';
import { UsersService } from '../../admin/users/services/users.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-docente-requests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './requests-list.component.html',
  styleUrl: './requests-list.component.css'
})
export class DocenteRequestsComponent implements OnInit {
  requests = signal<InventoryRequest[]>([]);
  mySpaces = signal<PhysicalSpace[]>([]);
  allSpacesList = signal<PhysicalSpace[]>([]);
  teachersList = signal<any[]>([]);
  availableItems = signal<any[]>([]); // Items list depending on request type
  
  selectedSourceSpaceId = signal<string>('');
  selectedDestinationTeacherId = signal<string>('');
  selectedRequestType = signal<string>('NUEVO_INVENTARIO');
  searchQuery = signal<string>('');
  activeTab = signal<string>('TODOS');

  isLoading = signal(false);
  modalLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modales
  showCreateModal = signal(false);
  showDetailModal = signal(false);
  selectedRequest = signal<InventoryRequest | null>(null);

  // Formulario de Cabecera y Filtros
  requestForm: FormGroup;
  docenteFilterForm: FormGroup;

  // Filtros de listado principal del docente
  selectedFilterStatus = signal<string>('');
  selectedFilterType = signal<string>('');
  selectedFilterSpaceId = signal<string>('');

  // Items seleccionados interactivamente
  selectedItemsTemp = signal<Array<{ itemId: string; name: string; codeValue: string; cantidad: number; maxAvailable: number; viewCode: string }>>([]);

  filteredDocenteRequests = computed(() => {
    let list = this.requests();
    const status = this.selectedFilterStatus();
    const type = this.selectedFilterType();
    const spaceId = this.selectedFilterSpaceId();

    if (status) {
      list = list.filter((r) => r.status === status);
    }
    if (type) {
      list = list.filter((r) => r.type === type);
    }
    if (spaceId) {
      list = list.filter((r) => r.spaceId === spaceId || r.destinationSpaceId === spaceId);
    }
    return list;
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly requestsService: RequestsService,
    private readonly spacesService: SpacesService,
    private readonly inventoryService: InventoryService,
    private readonly usersService: UsersService
  ) {
    this.requestForm = this.fb.group({
      spaceId: ['', [Validators.required]],
      destinationSpaceId: [''],
      destinationTeacherId: [''],
      type: ['NUEVO_INVENTARIO', [Validators.required]],
      motive: ['', [Validators.required, Validators.minLength(10)]]
    });

    this.docenteFilterForm = this.fb.group({
      status: [''],
      type: [''],
      spaceId: ['']
    });

    // Escuchar cambios reactivos en el formulario de filtros del docente
    this.docenteFilterForm.valueChanges.subscribe((val) => {
      this.selectedFilterStatus.set(val.status || '');
      this.selectedFilterType.set(val.type || '');
      this.selectedFilterSpaceId.set(val.spaceId || '');
    });

    // Escuchar cambios de tipo de solicitud
    this.requestForm.get('type')?.valueChanges.subscribe((type) => {
      this.selectedItemsTemp.set([]);
      this.availableItems.set([]);
      this.searchQuery.set('');
      this.activeTab.set('TODOS');
      this.requestForm.patchValue({ spaceId: '', destinationSpaceId: '', destinationTeacherId: '' }, { emitEvent: false });
      this.selectedRequestType.set(type);
      this.selectedSourceSpaceId.set('');
      this.selectedDestinationTeacherId.set('');
      
      // Ajustar validadores dinámicamente
      const destSpaceControl = this.requestForm.get('destinationSpaceId');
      const destTeacherControl = this.requestForm.get('destinationTeacherId');

      if (type === 'TRASPASO_DOCENTE') {
        destSpaceControl?.setValidators([Validators.required]);
        destTeacherControl?.setValidators([Validators.required]);
      } else if (type === 'TRANSFERENCIA_AULAS' || type === 'SOLICITUD_EXTERNA') {
        destSpaceControl?.setValidators([Validators.required]);
        destTeacherControl?.clearValidators();
      } else {
        destSpaceControl?.clearValidators();
        destTeacherControl?.clearValidators();
      }
      destSpaceControl?.updateValueAndValidity({ emitEvent: false });
      destTeacherControl?.updateValueAndValidity({ emitEvent: false });
    });

    // Escuchar cambios de docente destinatario para mantener la reactividad de las señales
    this.requestForm.get('destinationTeacherId')?.valueChanges.subscribe((teacherId) => {
      this.selectedDestinationTeacherId.set(teacherId || '');
    });

    // Escuchar cambios de aula origen
    this.requestForm.get('spaceId')?.valueChanges.subscribe((spaceId) => {
      this.selectedSourceSpaceId.set(spaceId || '');
      this.searchQuery.set('');
      this.selectedItemsTemp.set([]);
      if (spaceId || this.selectedRequestType() === 'NUEVO_INVENTARIO') {
        this.loadAvailableItems(spaceId);
      } else {
        this.availableItems.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.loadMyRequests();
    this.loadMySpaces();
    this.loadActiveTeachers();
  }

  loadMyRequests(): void {
    this.isLoading.set(true);
    this.requestsService.getAllRequests().subscribe({
      next: (res: InventoryRequest[]) => {
        this.requests.set(res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.isLoading.set(false);
      },
      error: () => {
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

    this.spacesService.getAllSpaces({ allSpaces: 'true' }).subscribe({
      next: (res: PhysicalSpace[]) => {
        this.allSpacesList.set(res);
      }
    });
  }

  loadActiveTeachers(): void {
    this.usersService.getUsers(1, 200, { rol: 'DOCENTE', estado: 'ACTIVO' }).subscribe({
      next: (res: any) => {
        this.teachersList.set(res.data || res.items || []);
      }
    });
  }

  // Lista de espacios de origen según el tipo de solicitud
  sourceSpacesList = computed(() => {
    const type = this.selectedRequestType();
    if (type === 'SOLICITUD_EXTERNA') {
      return this.allSpacesList(); // Para solicitud externa: cualquier aula del sistema es origen
    }
    return this.mySpaces(); // De lo contrario: solo mis aulas son origen
  });

  // Lista filtrada de artículos por pestaña de vista y buscador
  // Detección dinámica de vistas con artículos asociados para la solicitud
  availableViews = computed(() => {
    let list = this.availableItems();
    if (this.selectedRequestType() === 'MANTENIMIENTO' || this.selectedRequestType() === 'BAJA_DEFINITIVA') {
      list = list.filter((item) => {
        const viewCode = item.inventoryView?.code || item.viewCode || '';
        return viewCode !== 'INSUMOS';
      });
    }

    const hasBienes = list.some((item) => {
      const code = item.inventoryView?.code || item.viewCode || '';
      return code === 'BIENES_PUBLICOS';
    });
    const hasInsumos = list.some((item) => {
      const code = item.inventoryView?.code || item.viewCode || '';
      return code === 'INSUMOS';
    });
    const hasBiblioteca = list.some((item) => {
      const code = item.inventoryView?.code || item.viewCode || '';
      return code === 'BIBLIOTECA';
    });
    return { hasBienes, hasInsumos, hasBiblioteca };
  });

  filteredAvailableItems = computed(() => {

    const query = this.searchQuery().toLowerCase().trim();
    const tab = this.activeTab();
    let items = this.availableItems();

    // Excluir INSUMOS si es una solicitud de MANTENIMIENTO o BAJA_DEFINITIVA
    if (this.selectedRequestType() === 'MANTENIMIENTO' || this.selectedRequestType() === 'BAJA_DEFINITIVA') {
      items = items.filter((item) => {
        const viewCode = item.inventoryView?.code || item.viewCode || '';
        return viewCode !== 'INSUMOS';
      });
    }

    // 1. Filtrar por pestaña
    if (tab !== 'TODOS') {
      items = items.filter((item) => {
        const viewCode = item.inventoryView?.code || item.viewCode || '';
        return viewCode === tab;
      });
    }

    // 2. Filtrar por buscador
    if (!query) return items;
    return items.filter((item) => {
      const name = (item.name || item.dynamicValues?.['nombre'] || '').toLowerCase();
      const code = (item.codigoYavirac || item.codeValue || '').toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  });

  loadAvailableItems(spaceId: string): void {
    const type = this.selectedRequestType();

    if (type === 'NUEVO_INVENTARIO') {
      // Cargar inventario libre en Bodega (sin aula asignada)
      this.inventoryService.getItems(1, 300, { searchOnlyInWarehouse: 'true' }).subscribe({
        next: (res: any) => {
          const items = (res.data || []).map((item: any) => {
            const activeReportCount = 0; // En bodega no suele haber reportes activos
            const totalQty = Number(item.cantidad || 0);
            const qtyAvailable = Math.max(0, totalQty - activeReportCount);
            return {
              id: item.id,
              name: item.name,
              codeValue: item.codeValue || item.codigoYavirac || '',
              cantidad: totalQty,
              maxAvailable: qtyAvailable,
              viewCode: item.inventoryView?.code || 'GENERAL',
              estadoFisico: item.estadoFisico || 'BUENO'
            };
          });
          this.availableItems.set(items);
        }
      });
    } else {
      if (!spaceId) {
        this.availableItems.set([]);
        return;
      }
      // Cargar inventario del aula de origen
      this.spacesService.getSpaceById(spaceId, true).subscribe({
        next: (space: PhysicalSpace) => {
          const items = space.items?.map((item: any) => {
            // Extraer las cantidades afectadas en reportes de novedades activos
            const activeReports = item.activeReportsList || [];
            const activeReportCount = activeReports.reduce((acc: number, r: any) => acc + (r.cantidadAfectada || 1), 0);
            const totalQty = Number(item.cantidad || 0);
            const qtyAvailable = Math.max(0, totalQty - activeReportCount);

            return {
              id: item.id,
              name: item.name,
              codeValue: item.codeValue || item.codigoYavirac || '',
              cantidad: totalQty,
              maxAvailable: qtyAvailable,
              viewCode: item.inventoryView?.code || 'GENERAL',
              estadoFisico: item.estadoFisico || 'BUENO'
            };
          }) || [];
          this.availableItems.set(items);
        }
      });
    }
  }

  // Métodos de selección interactiva de tarjetas
  isItemSelected(itemId: string): boolean {
    return this.selectedItemsTemp().some((i) => i.itemId === itemId);
  }

  getSelectedItemQuantity(itemId: string): number {
    const found = this.selectedItemsTemp().find((i) => i.itemId === itemId);
    return found ? found.cantidad : 1;
  }

  toggleItem(item: any): void {
    const current = [...this.selectedItemsTemp()];
    const index = current.findIndex((i) => i.itemId === item.id);

    if (index > -1) {
      // Si ya está seleccionado, lo quitamos
      current.splice(index, 1);
    } else {
      // Validar si tiene stock utilizable
      if (item.maxAvailable <= 0) {
        Swal.fire({
          title: 'Artículo bloqueado',
          text: 'Este artículo tiene todas sus unidades con novedades activas.',
          icon: 'warning',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#fb7185'
        });
        return;
      }
      if (item.viewCode !== 'INSUMOS' && item.estadoFisico !== 'BUENO') {
        Swal.fire({
          title: 'Artículo en mal estado',
          text: 'Solo se pueden solicitar/mover artículos en estado BUENO.',
          icon: 'warning',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#fb7185'
        });
        return;
      }

      current.push({
        itemId: item.id,
        name: item.name,
        codeValue: item.codeValue,
        cantidad: 1,
        maxAvailable: item.maxAvailable,
        viewCode: item.viewCode
      });
    }
    this.selectedItemsTemp.set(current);
  }

  updateItemQuantity(itemId: string, newQty: any): void {
    let qty = parseInt(newQty, 10);
    if (isNaN(qty)) qty = 1;

    const current = [...this.selectedItemsTemp()];
    const found = current.find((i) => i.itemId === itemId);
    if (!found) return;

    if (qty < 1) {
      qty = 1;
    } else if (qty > found.maxAvailable) {
      qty = found.maxAvailable;
      Swal.fire({
        title: 'Límite de Stock',
        text: `La cantidad máxima utilizable para este artículo es ${found.maxAvailable} unidades.`,
        icon: 'info',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3b82f6'
      });
    }

    found.cantidad = qty;
    this.selectedItemsTemp.set(current);
  }

  preventNegativeSign(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === 'e' || event.key === 'E' || event.key === '+') {
      event.preventDefault();
    }
  }

  resetDocenteFilters(): void {
    this.docenteFilterForm.reset({
      status: '',
      type: '',
      spaceId: ''
    });
  }

  onQuantityInput(itemId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    let qty = parseInt(input.value, 10);
    
    // Si borra el número o deja vacío, no hacemos nada de inmediato (para que pueda escribir)
    if (input.value === '') return;

    const found = this.selectedItemsTemp().find(i => i.itemId === itemId);
    if (!found) return;

    if (isNaN(qty) || qty < 1) {
      qty = 1;
    } else if (qty > found.maxAvailable) {
      qty = found.maxAvailable;
      Swal.fire({
        title: 'Límite de Stock',
        text: `La cantidad máxima utilizable para este artículo es ${found.maxAvailable} unidades.`,
        icon: 'info',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3b82f6'
      });
    }
    
    // Forzar el valor en el input
    input.value = qty.toString();
    
    // Actualizar la señal
    this.updateItemQuantity(itemId, qty);
  }

  formatResponsibles(space: PhysicalSpace): string {
    if (!space.responsibleTeachers || space.responsibleTeachers.length === 0) {
      return 'Sin Responsable';
    }
    return space.responsibleTeachers.map((t: any) => `${t.nombres} ${t.apellidos}`).join(', ');
  }

  openCreateModal(): void {
    this.selectedItemsTemp.set([]);
    this.requestForm.reset({
      spaceId: '',
      destinationSpaceId: '',
      destinationTeacherId: '',
      type: 'NUEVO_INVENTARIO',
      motive: ''
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  openDetailModal(req: InventoryRequest): void {
    this.selectedRequest.set(req);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
  }

  onSubmitRequest(): void {
    if (this.requestForm.invalid) {
      this.errorMessage.set('Por favor, complete todos los campos obligatorios del formulario.');
      return;
    }
    if (this.selectedItemsTemp().length === 0) {
      this.errorMessage.set('Debes seleccionar al menos un artículo en el listado.');
      return;
    }

    const val = this.requestForm.value;
    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const payload = {
      spaceId: val.spaceId,
      destinationSpaceId: val.destinationSpaceId || null,
      destinationTeacherId: val.type === 'TRASPASO_DOCENTE' ? val.destinationTeacherId : null,
      type: val.type,
      motive: val.motive.trim(),
      items: this.selectedItemsTemp().map((i) => ({
        itemId: i.itemId,
        cantidad: i.cantidad
      }))
    };

    this.requestsService.createRequest(payload).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Solicitud enviada con éxito al administrador.');
        setTimeout(() => {
          this.closeCreateModal();
          this.loadMyRequests();
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al procesar la solicitud.');
      }
    });
  }

  downloadActa(req: InventoryRequest): void {
    Swal.fire({
      title: 'Generando Acta PDF...',
      text: 'Por favor, espere un momento.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.requestsService.downloadActaPdf(req.id).subscribe({
      next: (blob: Blob) => {
        Swal.close();
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
      },
      error: () => {
        Swal.fire({
          title: 'Error',
          text: 'No se pudo descargar el acta PDF. Inténtelo más tarde.',
          icon: 'error',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#fb7185'
        });
      }
    });
  }

  // Filtrar aulas de destino de forma reactiva por señales
  filteredDestinationSpaces = computed(() => {
    const spaceId = this.selectedSourceSpaceId();
    const type = this.selectedRequestType();
    const destTeacherId = this.selectedDestinationTeacherId();
    
    if (type === 'TRASPASO_DOCENTE') {
      if (!destTeacherId) return [];
      // Para traspaso entre docentes: mostrar aulas a cargo del docente de destino
      const teacherObj = this.teachersList().find((t) => t.id === destTeacherId);
      if (teacherObj) {
        // Obtenemos aulas donde el docente destinatario es responsable
        return this.allSpacesList().filter((s) => 
          s.responsibleTeachers?.some((t: any) => t.id === destTeacherId) && s.id !== spaceId
        );
      }
      return [];
    }
    // De lo contrario: mostrar mis aulas de destino
    return this.mySpaces().filter((s) => s.id !== spaceId);
  });

  formatType(type: string): string {
    if (type === 'NUEVO_INVENTARIO') return 'Nuevo Inventario';
    if (type === 'TRASPASO_DOCENTE') return 'Traspaso a otro Docente';
    if (type === 'TRANSFERENCIA_AULAS') return 'Transferencia entre mis Aulas';
    if (type === 'SOLICITUD_EXTERNA') return 'Solicitud Externa (Aula Ajena)';
    if (type === 'DEVOLUCION_BODEGA') return 'Devolución a Bodega';
    if (type === 'BAJA_DEFINITIVA') return 'Baja Definitiva';
    if (type === 'MANTENIMIENTO') return 'Mantenimiento / Reparación';
    return type;
  }

  formatStatus(status: string): string {
    if (status === 'EN_PROCESO') return 'En Proceso';
    if (status === 'APROBADA') return 'Aprobada';
    if (status === 'RECHAZADA') return 'Rechazada';
    return status;
  }

  getIcon(type: string): string {
    if (type === 'NUEVO_INVENTARIO') return 'add_shopping_cart';
    if (type === 'TRASPASO_DOCENTE') return 'assignment_ind';
    if (type === 'TRANSFERENCIA_AULAS') return 'swap_horiz';
    if (type === 'SOLICITUD_EXTERNA') return 'outbound';
    if (type === 'DEVOLUCION_BODEGA') return 'keyboard_return';
    if (type === 'BAJA_DEFINITIVA') return 'delete_forever';
    if (type === 'MANTENIMIENTO') return 'build';
    return 'add_circle_outline';
  }

  getIconColor(type: string): string {
    if (type === 'NUEVO_INVENTARIO') return '#e11d48';
    if (type === 'TRASPASO_DOCENTE') return '#059669';
    if (type === 'TRANSFERENCIA_AULAS') return '#0284c7';
    if (type === 'SOLICITUD_EXTERNA') return '#7c3aed';
    if (type === 'DEVOLUCION_BODEGA') return '#ea580c';
    if (type === 'BAJA_DEFINITIVA') return '#4b5563';
    if (type === 'MANTENIMIENTO') return '#2563eb';
    return '#fb7185';
  }

  getIconBg(type: string): string {
    if (type === 'NUEVO_INVENTARIO') return 'rgba(244, 63, 94, 0.15)';
    if (type === 'TRASPASO_DOCENTE') return 'rgba(16, 185, 129, 0.15)';
    if (type === 'TRANSFERENCIA_AULAS') return 'rgba(56, 189, 248, 0.15)';
    if (type === 'SOLICITUD_EXTERNA') return 'rgba(139, 92, 246, 0.15)';
    if (type === 'DEVOLUCION_BODEGA') return 'rgba(251, 146, 60, 0.15)';
    if (type === 'BAJA_DEFINITIVA') return 'rgba(107, 114, 128, 0.15)';
    if (type === 'MANTENIMIENTO') return 'rgba(59, 130, 246, 0.15)';
    return 'rgba(251, 113, 133, 0.15)';
  }
}
