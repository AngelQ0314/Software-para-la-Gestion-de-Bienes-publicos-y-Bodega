import { Component, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RequestsService, InventoryRequest } from '../../../core/services/requests.service';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';
import { InventoryService } from '../../admin/inventory/services/inventory.service';
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
  availableItems = signal<any[]>([]); // Items list depending on request type
  
  selectedSourceSpaceId = signal<string>('');
  selectedRequestType = signal<string>('NUEVO_INVENTARIO');
  searchQuery = signal<string>('');

  isLoading = signal(false);
  modalLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modales
  showCreateModal = signal(false);
  showDetailModal = signal(false);
  selectedRequest = signal<InventoryRequest | null>(null);

  // Formularios
  requestForm: FormGroup;
  itemForm: FormGroup;

  // Items seleccionados en el formulario
  selectedItemsTemp = signal<Array<{ itemId: string; name: string; codeValue: string; cantidad: number }>>([]);

  constructor(
    private readonly fb: FormBuilder,
    private readonly requestsService: RequestsService,
    private readonly spacesService: SpacesService,
    private readonly inventoryService: InventoryService
  ) {
    this.requestForm = this.fb.group({
      spaceId: ['', [Validators.required]],
      destinationSpaceId: [''],
      type: ['NUEVO_INVENTARIO', [Validators.required]],
      motive: ['', [Validators.required, Validators.minLength(10)]]
    });

    this.itemForm = this.fb.group({
      selectedItemId: ['', [Validators.required]],
      cantidad: [1, [Validators.required, Validators.min(1)]]
    });

    // Escuchar cambios de tipo de solicitud
    this.requestForm.get('type')?.valueChanges.subscribe((type) => {
      this.selectedItemsTemp.set([]);
      this.availableItems.set([]);
      this.itemForm.patchValue({ selectedItemId: '' }, { emitEvent: false });
      this.searchQuery.set('');
      this.requestForm.patchValue({ spaceId: '', destinationSpaceId: '' }, { emitEvent: false });
      this.selectedRequestType.set(type);
      this.selectedSourceSpaceId.set('');
    });

    // Escuchar cambios de aula origen
    this.requestForm.get('spaceId')?.valueChanges.subscribe((spaceId) => {
      this.selectedSourceSpaceId.set(spaceId || '');
      this.searchQuery.set('');
      this.itemForm.patchValue({ selectedItemId: '' }, { emitEvent: false });
      if (spaceId) {
        this.loadAvailableItems(spaceId);
      } else {
        this.availableItems.set([]);
      }
    });

    // Autoseleccionar primer elemento que coincida en la búsqueda para ahorrar clics
    effect(() => {
      const items = this.filteredAvailableItems();
      const currentSelected = this.itemForm.get('selectedItemId')?.value;
      if (items.length > 0) {
        const exists = items.some((i) => i.id === currentSelected);
        if (!exists) {
          this.itemForm.patchValue({ selectedItemId: items[0].id }, { emitEvent: false });
        }
      } else {
        if (currentSelected !== '') {
          this.itemForm.patchValue({ selectedItemId: '' }, { emitEvent: false });
        }
      }
    });
  }

  ngOnInit(): void {
    this.loadMyRequests();
    this.loadMySpaces();
  }

  loadMyRequests(): void {
    this.isLoading.set(true);
    this.requestsService.getAllRequests().subscribe({
      next: (res: InventoryRequest[]) => {
        this.requests.set(res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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

    this.spacesService.getAllSpaces({ allSpaces: 'true' }).subscribe({
      next: (res: PhysicalSpace[]) => {
        this.allSpacesList.set(res);
      }
    });
  }

  // Lista de espacios de origen según el tipo de solicitud
  sourceSpacesList = computed(() => {
    const type = this.selectedRequestType();
    if (type === 'SOLICITUD_TRASPASO') {
      return this.allSpacesList();
    }
    return this.mySpaces();
  });

  // Lista filtrada de artículos disponibles según el buscador de texto
  filteredAvailableItems = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const items = this.availableItems();
    if (!query) return items;
    return items.filter((item) => {
      const name = (item.name || item.dynamicValues?.['nombre'] || '').toLowerCase();
      const code = (item.codigoYavirac || item.codeValue || '').toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  });

  loadAvailableItems(spaceId: string): void {
    const type = this.selectedRequestType();

    if (type === 'TRANSFERENCIA' || type === 'TRASPASO_DOCENTE' || type === 'SOLICITUD_TRASPASO') {
      // Cargar inventario asignado al aula de origen
      this.spacesService.getSpaceById(spaceId).subscribe({
        next: (space: PhysicalSpace) => {
          const items = space.items?.map((item: any) => ({
            id: item.id,
            name: item.name,
            codigoYavirac: item.codeValue || '',
            stockDisponible: item.cantidad || 1
          })) || [];
          this.availableItems.set(items);
        }
      });
    } else {
      // NUEVO_INVENTARIO: Cargar inventario general en bodega (donde el espacio físico es nulo)
      this.inventoryService.getItems(1, 200, { searchOnlyInWarehouse: 'true' }).subscribe({
        next: (res: any) => {
          this.availableItems.set(res.data || []);
        }
      });
    }
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
      type: 'NUEVO_INVENTARIO',
      motive: ''
    });
    this.itemForm.reset({
      selectedItemId: '',
      cantidad: 1
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

  addTempItem(): void {
    if (this.itemForm.invalid) return;

    const val = this.itemForm.value;
    const itemId = val.selectedItemId;
    const qty = Number(val.cantidad);

    if (isNaN(qty) || qty < 1) {
      Swal.fire({
        title: 'Cantidad inválida',
        text: 'La cantidad debe ser mayor o igual a 1.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#fb7185'
      });
      return;
    }

    const itemObj = this.availableItems().find((i) => i.id === itemId);
    if (!itemObj) return;

    // Si es transferencia o traspaso, validar contra el stock disponible en el aula origen
    const type = this.selectedRequestType();
    if (type === 'TRANSFERENCIA' || type === 'TRASPASO_DOCENTE') {
      const maxAvailable = itemObj.stockDisponible || 1;
      const currentSelected = this.selectedItemsTemp().find((i) => i.itemId === itemId)?.cantidad || 0;
      if (currentSelected + qty > maxAvailable) {
        Swal.fire({
          title: 'Stock insuficiente',
          text: `No puedes exceder el stock disponible en el aula (${maxAvailable} unidades).`,
          icon: 'warning',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#fb7185'
        });
        return;
      }
    }

    const current = [...this.selectedItemsTemp()];
    const existingIndex = current.findIndex((i) => i.itemId === itemId);

    if (existingIndex > -1) {
      current[existingIndex].cantidad += qty;
    } else {
      current.push({
        itemId: itemObj.id,
        name: itemObj.name || itemObj.dynamicValues?.['nombre'] || 'Artículo',
        codeValue: itemObj.codigoYavirac || itemObj.codeValue || '',
        cantidad: qty
      });
    }

    this.selectedItemsTemp.set(current);
    this.itemForm.patchValue({
      selectedItemId: '',
      cantidad: 1
    });
  }

  removeTempItem(index: number): void {
    const current = [...this.selectedItemsTemp()];
    current.splice(index, 1);
    this.selectedItemsTemp.set(current);
  }

  onSubmitRequest(): void {
    if (this.requestForm.invalid) return;
    if (this.selectedItemsTemp().length === 0) {
      this.errorMessage.set('Debes agregar al menos un artículo a tu solicitud.');
      return;
    }

    const val = this.requestForm.value;
    const needDest = val.type === 'TRANSFERENCIA' || val.type === 'TRASPASO_DOCENTE' || val.type === 'SOLICITUD_TRASPASO';
    if (needDest && !val.destinationSpaceId) {
      this.errorMessage.set('Debes seleccionar un espacio de destino para el movimiento.');
      return;
    }

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const payload = {
      spaceId: val.spaceId,
      destinationSpaceId: needDest ? val.destinationSpaceId : null,
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
        this.errorMessage.set(err.error?.message || 'Error al procesar solicitud.');
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
      error: (err: any) => {
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
    
    if (type === 'TRASPASO_DOCENTE') {
      return this.allSpacesList().filter((s) => s.id !== spaceId);
    }
    if (type === 'SOLICITUD_TRASPASO') {
      return this.mySpaces().filter((s) => s.id !== spaceId);
    }
    return this.mySpaces().filter((s) => s.id !== spaceId);
  });

  formatType(type: string): string {
    if (type === 'TRANSFERENCIA') return 'Transferencia entre mis Espacios';
    if (type === 'TRASPASO_DOCENTE') return 'Traspaso a otro Espacio';
    if (type === 'SOLICITUD_TRASPASO') return 'Solicitud de traspaso desde otro Espacio';
    return 'Nuevo Inventario';
  }

  formatStatus(status: string): string {
    if (status === 'EN_PROCESO') return 'En Proceso';
    if (status === 'APROBADA') return 'Aprobada';
    if (status === 'RECHAZADA') return 'Rechazada';
    return status;
  }
}
