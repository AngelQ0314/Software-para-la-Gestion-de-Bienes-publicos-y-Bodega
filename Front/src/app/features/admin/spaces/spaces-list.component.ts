import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';
import { UsersService } from '../users/services/users.service';
import { InventoryService } from '../inventory/services/inventory.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-spaces-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './spaces-list.component.html',
  styleUrl: './spaces-list.component.css'
})
export class SpacesListComponent implements OnInit {
  spaces = signal<PhysicalSpace[]>([]);
  teachers = signal<any[]>([]);
  inventoryItems = signal<any[]>([]);
  inventoryViews = signal<any[]>([]);
  selectedFilterView = signal<string>('');
  showUnavailableItems = signal<boolean>(false);
  hideAssignedItems = signal<boolean>(false);
  // Vista del modal de asignar artículos (independiente del tab de inventario asignado)
  assignModalFilterView = signal<string>('');
  isLoading = signal(false);
  modalLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modales
  showCreateModal = signal(false);
  showEditModal = signal(false);
  showTeachersModal = signal(false);
  showInventoryModal = signal(false);
  showDetailModal = signal(false);
  showAddTeachersModal = signal(false);
  showRemoveTeachersModal = signal(false);
  activeTab = signal<'info' | 'docentes' | 'inventario'>('info');
  selectedSpace = signal<PhysicalSpace | null>(null);

  // Formularios
  filterForm: FormGroup;
  spaceForm: FormGroup;
  teachersForm: FormGroup;
  inventoryForm: FormGroup;

  // Asignación de Inventario (temporal en modal)
  assignedItemsTemp = signal<Array<{ itemId: string; name: string; codeValue: string; cantidad: number }>>([]);
  itemSearchQuery = signal('');
  teacherSearchQuery = signal('');
  showAssignItemsModal = signal(false);
  categories = signal<any[]>([]);
  subcategories = signal<any[]>([]);
  selectedFilterCategory = signal<string>('');
  selectedFilterSubcategory = signal<string>('');

  // Filtros específicos para el tab de Inventario Asignado en Ficha del Espacio
  assignedTabCategory = signal<string>('');
  assignedTabSubcategory = signal<string>('');
  assignedTabSearchQuery = signal<string>('');
  
  // Gestión de Docentes Responsables
  responsibleTeachersSearchQuery = signal('');
  addTeachersSearchQuery = signal('');
  removeTeachersSearchQuery = signal('');
  selectedTeachersToAdd = signal<string[]>([]);
  selectedTeachersToRemove = signal<string[]>([]);


  constructor(
    private readonly fb: FormBuilder,
    private readonly spacesService: SpacesService,
    private readonly usersService: UsersService,
    private readonly inventoryService: InventoryService
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      type: [''],
      location: [''],
      jornada: [''],
      teacherName: ['']
    });

    // Filtros reactivos instantáneos
    this.filterForm.valueChanges.subscribe(() => {
      this.loadSpaces();
    });

    this.spaceForm = this.fb.group({
      roomNumber: ['', [Validators.required, Validators.minLength(2)]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      type: ['AULA', [Validators.required]],
      location: ['', [Validators.required]],
      capacity: [30, [Validators.required, Validators.min(1), Validators.max(500)]],
      jornadas: this.fb.group({
        MATUTINA: [false],
        VESPERTINA: [false],
        NOCTURNA: [false]
      })
    });

    this.teachersForm = this.fb.group({});
    this.inventoryForm = this.fb.group({
      selectedItemId: ['', [Validators.required]],
      assignQuantity: [1, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.loadSpaces();
    this.loadTeachers();
    this.loadInventoryViews();
    this.loadInventoryItems();

    this.inventoryForm.get('selectedItemId')?.valueChanges.subscribe((itemId) => {
      if (!itemId) return;
      const itemObj = this.inventoryItems().find((i) => i.id === itemId);
      if (itemObj) {
        const viewCode = itemObj.inventoryView?.code;
        if (viewCode === 'BIENES_PUBLICOS' || viewCode === 'BIBLIOTECA') {
          this.inventoryForm.get('assignQuantity')?.setValue(1);
        }
      }
    });
  }

  // Cargar Espacios
  loadSpaces(): void {
    this.isLoading.set(true);
    const formVal = this.filterForm.value;

    const filters: any = {
      type: formVal.type,
      location: formVal.location,
      jornada: formVal.jornada,
      teacherName: formVal.teacherName
    };

    if (formVal.search?.trim()) {
      filters.name = formVal.search.trim();
      filters.roomNumber = formVal.search.trim();
    }

    this.spacesService.getAllSpaces(filters).subscribe({
      next: (res: PhysicalSpace[]) => {
        this.spaces.set(res);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.errorMessage.set('Error al cargar espacios físicos.');
        this.isLoading.set(false);
      }
    });
  }

  resetFilters(): void {
    this.filterForm.reset({
      search: '',
      type: '',
      location: '',
      jornada: '',
      teacherName: ''
    });
  }

  // Cargar Docentes (para vinculación)
  loadTeachers(): void {
    this.usersService.getUsers(1, 200, { rol: 'DOCENTE', estado: 'ACTIVO' }).subscribe({
      next: (res: any) => {
        this.teachers.set(res.data || []);
      }
    });
  }

  loadInventoryViews(): void {
    this.inventoryService.getViews().subscribe({
      next: (res: any[]) => {
        this.inventoryViews.set(res || []);
        if (res && res.length > 0 && !this.selectedFilterView()) {
          const firstViewId = res[0].id;
          this.selectedFilterView.set(firstViewId);
          this.loadInventoryItems('', firstViewId);
        }
      }
    });
  }

  // Cargar items de inventario general con soporte de búsqueda en servidor
  loadInventoryItems(
    search: string = '', 
    viewId: string = '', 
    categoryId: string = '', 
    subcategoryId: string = ''
  ): void {
    const filters: any = {};
    if (search.trim()) {
      filters.search = search.trim();
    }
    if (viewId) {
      filters.inventoryViewId = viewId;
    }
    if (categoryId) {
      filters.categoryId = categoryId;
    }
    if (subcategoryId) {
      filters.subcategoryId = subcategoryId;
    }
    // Limitamos a 100 resultados de búsqueda en tiempo real
    this.inventoryService.getItems(1, 100, filters).subscribe({
      next: (res: any) => {
        const data = res.data || [];
        this.inventoryItems.set(data);
        
        // Si hay una búsqueda activa y devuelve resultados, autoseleccionamos el primero
        if (search.trim() && data.length > 0) {
          this.inventoryForm.patchValue({
            selectedItemId: data[0].id
          });
        }
      }
    });
  }

  // Categorías filtradas según la vista del modal de asignación
  filteredCategories = computed(() => {
    const view = this.inventoryViews().find(v => v.id === this.assignModalFilterView());
    const viewCode = view?.code || '';
    const cats = this.categories();
    if (!viewCode) return cats;
    return cats.filter((c: any) => c.baseView === viewCode);
  });

  filteredSubcategories = computed(() => {
    const catId = this.selectedFilterCategory();
    const subs = this.subcategories();
    if (!catId) return subs;
    // El servicio mapea el campo como 'categoriaId'
    return subs.filter((s: any) => s.categoriaId === catId);
  });

  loadCategories(): void {
    this.inventoryService.getCategories().subscribe({
      next: (res) => {
        this.categories.set(res || []);
      }
    });
  }

  loadSubcategories(): void {
    this.inventoryService.getSubcategories().subscribe({
      next: (res) => {
        this.subcategories.set(res || []);
      }
    });
  }

  openAssignItemsModal(): void {
    // Sincronizar la vista del modal con la vista activa del tab
    this.assignModalFilterView.set(this.selectedFilterView());
    this.itemSearchQuery.set('');
    this.selectedFilterCategory.set('');
    this.selectedFilterSubcategory.set('');
    this.showUnavailableItems.set(false);
    
    this.loadCategories();
    this.loadSubcategories();
    
    // Cargar ítems con la vista actual del tab de inventario
    this.loadInventoryItems('', this.assignModalFilterView(), '', '');
    this.showAssignItemsModal.set(true);
  }

  closeAssignItemsModal(): void {
    this.showAssignItemsModal.set(false);
  }

  updateAssignItemsFilter(search?: string, catId?: string, subId?: string): void {
    if (search !== undefined) this.itemSearchQuery.set(search);
    if (catId !== undefined) {
      this.selectedFilterCategory.set(catId);
      this.selectedFilterSubcategory.set('');
    }
    if (subId !== undefined) this.selectedFilterSubcategory.set(subId);

    this.loadInventoryItems(
      this.itemSearchQuery(),
      this.assignModalFilterView(),
      this.selectedFilterCategory(),
      this.selectedFilterSubcategory()
    );
  }

  // Cambiar vista en el modal de asignación SIN afectar el inventario asignado del tab
  switchAssignModalView(viewId: string): void {
    this.assignModalFilterView.set(viewId);
    this.itemSearchQuery.set('');
    this.selectedFilterCategory.set('');
    this.selectedFilterSubcategory.set('');
    this.loadInventoryItems('', viewId, '', '');
  }


  // Modales
  openCreateModal(): void {
    this.spaceForm.reset({
      roomNumber: '',
      name: '',
      type: 'AULA',
      location: '',
      capacity: 30,
      jornadas: {
        MATUTINA: false,
        VESPERTINA: false,
        NOCTURNA: false
      }
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  openEditModal(space: PhysicalSpace): void {
    this.selectedSpace.set(space);
    this.spaceForm.reset({
      roomNumber: space.roomNumber,
      name: space.name,
      type: space.type,
      location: space.location,
      capacity: space.capacity,
      jornadas: {
        MATUTINA: space.jornadas.includes('MATUTINA'),
        VESPERTINA: space.jornadas.includes('VESPERTINA'),
        NOCTURNA: space.jornadas.includes('NOCTURNA')
      }
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
  }

  openSpaceDetails(space: PhysicalSpace): void {
    this.selectedSpace.set(space);
    this.activeTab.set('info');
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.teacherSearchQuery.set('');

    // Inicializar docentes
    const group: any = {};
    this.teachers().forEach((t: any) => {
      const isLinked = space.responsibleTeachers?.some((rt: any) => rt.id === t.id) || false;
      group[t.id] = [isLinked];
    });
    this.teachersForm = this.fb.group(group);

    // Inicializar inventario
    const items = space.items?.map((item: any) => ({
      itemId: item.id,
      name: item.name,
      codeValue: item.codeValue || '',
      cantidad: (item.cantidad !== undefined && item.cantidad !== null) ? item.cantidad : 1
    })) || [];
    this.assignedItemsTemp.set(items);
    this.itemSearchQuery.set('');
    this.assignedTabSearchQuery.set('');
    this.assignedTabCategory.set('');
    this.assignedTabSubcategory.set('');
    this.loadCategories();
    this.loadSubcategories();
    const firstViewId = this.inventoryViews().length > 0 ? this.inventoryViews()[0].id : '';
    this.selectedFilterView.set(firstViewId);
    this.showUnavailableItems.set(false);
    this.hideAssignedItems.set(false);
    this.loadInventoryItems('', firstViewId);

    this.inventoryForm.reset({
      selectedItemId: '',
      assignQuantity: 1
    });

    this.showDetailModal.set(true);
  }

  closeSpaceDetails(): void {
    this.showDetailModal.set(false);
    this.selectedSpace.set(null);
    this.teacherSearchQuery.set('');
  }


  openTeachersModal(space: PhysicalSpace, openOverlay: boolean = true): void {
    this.selectedSpace.set(space);
    this.modalLoading.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Dinámicamente creamos los form controls
    const group: any = {};
    this.teachers().forEach((t: any) => {
      const isLinked = space.responsibleTeachers?.some((rt: any) => rt.id === t.id) || false;
      group[t.id] = [isLinked];
    });
    this.teachersForm = this.fb.group(group);

    if (openOverlay) {
      this.showTeachersModal.set(true);
    }
  }

  closeTeachersModal(): void {
    this.showTeachersModal.set(false);
  }

  openInventoryModal(space: PhysicalSpace, openOverlay: boolean = true): void {
    this.selectedSpace.set(space);
    this.modalLoading.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Cargamos los artículos que el espacio ya tiene
    const items = space.items?.map((item: any) => ({
      itemId: item.id,
      name: item.name,
      codeValue: item.codeValue || '',
      cantidad: (item.cantidad !== undefined && item.cantidad !== null) ? item.cantidad : 1
    })) || [];
    
    this.assignedItemsTemp.set(items);
    this.itemSearchQuery.set('');
    const firstViewId = this.inventoryViews().length > 0 ? this.inventoryViews()[0].id : '';
    this.selectedFilterView.set(firstViewId);
    this.showUnavailableItems.set(false);
    this.hideAssignedItems.set(false);
    this.loadInventoryItems('', firstViewId);

    this.inventoryForm.reset({
      selectedItemId: '',
      assignQuantity: 1
    });

    if (openOverlay) {
      this.showInventoryModal.set(true);
    }
  }

  closeInventoryModal(): void {
    this.showInventoryModal.set(false);
  }


  // ACCIONES API
  onCreateSubmit(): void {
    if (this.spaceForm.invalid) return;

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const val = this.spaceForm.value;
    const selectedJornadas = Object.keys(val.jornadas).filter((k) => val.jornadas[k]);

    if (selectedJornadas.length === 0) {
      this.errorMessage.set('Debes seleccionar al menos una jornada académica.');
      this.modalLoading.set(false);
      return;
    }

    const payload = {
      roomNumber: val.roomNumber.trim(),
      name: val.name.trim(),
      type: val.type,
      location: val.location.trim(),
      capacity: Number(val.capacity),
      jornadas: selectedJornadas
    };

    this.spacesService.createSpace(payload).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Espacio físico registrado con éxito.');
        setTimeout(() => {
          this.closeCreateModal();
          this.loadSpaces();
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al registrar espacio físico.');
      }
    });
  }

  onEditSubmit(): void {
    if (this.spaceForm.invalid) return;
    const spaceId = this.selectedSpace()?.id;
    if (!spaceId) return;

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const val = this.spaceForm.value;
    const selectedJornadas = Object.keys(val.jornadas).filter((k) => val.jornadas[k]);

    if (selectedJornadas.length === 0) {
      this.errorMessage.set('Debes seleccionar al menos una jornada académica.');
      this.modalLoading.set(false);
      return;
    }

    const payload = {
      roomNumber: val.roomNumber.trim(),
      name: val.name.trim(),
      type: val.type,
      location: val.location.trim(),
      capacity: Number(val.capacity),
      jornadas: selectedJornadas
    };

    this.spacesService.updateSpace(spaceId, payload).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Espacio físico actualizado con éxito.');
        setTimeout(() => {
          this.closeEditModal();
          this.loadSpaces();
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al actualizar espacio físico.');
      }
    });
  }

  deleteSpace(space: PhysicalSpace): void {
    Swal.fire({
      title: '¿Eliminar Espacio Físico?',
      text: `¿Estás seguro de que deseas eliminar el espacio "${space.roomNumber} - ${space.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.isLoading.set(true);
        this.spacesService.deleteSpace(space.id).subscribe({
          next: () => {
            Swal.fire({
              title: '¡Eliminado!',
              text: 'El espacio físico fue eliminado correctamente.',
              icon: 'success',
              confirmButtonText: 'Aceptar'
            });
            this.loadSpaces();
            if (this.showDetailModal() && this.selectedSpace()?.id === space.id) {
              this.closeSpaceDetails();
            }
          },
          error: (err: any) => {
            this.isLoading.set(false);
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'No se puede eliminar el espacio físico porque tiene inventario asignado.',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }

  // Vincular Docentes Submit
  onTeachersSubmit(): void {
    const spaceId = this.selectedSpace()?.id;
    if (!spaceId) return;

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const formVal = this.teachersForm.value;
    const teacherIds = Object.keys(formVal).filter((id) => formVal[id]);

    this.spacesService.linkTeachers(spaceId, teacherIds).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Docentes vinculados correctamente.');
        
        // Recargar los espacios y actualizar el espacio seleccionado para el modal de detalles
        this.spacesService.getAllSpaces().subscribe((res) => {
          this.spaces.set(res);
          const updated = res.find((s) => s.id === spaceId);
          if (updated) {
            this.selectedSpace.set(updated);
          }
        });

        setTimeout(() => {
          this.successMessage.set(null);
          if (!this.showDetailModal()) {
            this.closeTeachersModal();
          }
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al vincular docentes.');
      }
    });
  }

  // ==========================================================
  // GESTIÓN DE DOCENTES (AGREGAR Y DESVINCULAR EN SUB-MODALES)
  // ==========================================================
  openAddTeachersModal(): void {
    this.selectedTeachersToAdd.set([]);
    this.addTeachersSearchQuery.set('');
    this.showAddTeachersModal.set(true);
  }

  closeAddTeachersModal(): void {
    this.showAddTeachersModal.set(false);
  }

  toggleTeacherToAdd(teacherId: string): void {
    const current = [...this.selectedTeachersToAdd()];
    const index = current.indexOf(teacherId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(teacherId);
    }
    this.selectedTeachersToAdd.set(current);
  }

  isTeacherSelectedToAdd(teacherId: string): boolean {
    return this.selectedTeachersToAdd().includes(teacherId);
  }

  submitAddTeachers(): void {
    const spaceId = this.selectedSpace()?.id;
    if (!spaceId) return;

    const toAdd = this.selectedTeachersToAdd();
    if (toAdd.length === 0) return;

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    // Obtener responsables actuales
    const currentResponsibleIds = this.selectedSpace()?.responsibleTeachers?.map((t: any) => t.id) || [];
    // Unir los actuales con los nuevos
    const newResponsibleIds = Array.from(new Set([...currentResponsibleIds, ...toAdd]));

    this.spacesService.linkTeachers(spaceId, newResponsibleIds).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Docente(s) agregado(s) con éxito.');
        this.closeAddTeachersModal();

        // Recargar los espacios y actualizar el espacio seleccionado para el modal de detalles
        this.spacesService.getAllSpaces().subscribe((res) => {
          this.spaces.set(res);
          const updated = res.find((s) => s.id === spaceId);
          if (updated) {
            this.selectedSpace.set(updated);
            
            // Sincronizar el formulario base de Angular
            const group: any = {};
            this.teachers().forEach((t: any) => {
              const isLinked = updated.responsibleTeachers?.some((rt: any) => rt.id === t.id) || false;
              group[t.id] = [isLinked];
            });
            this.teachersForm = this.fb.group(group);
          }
        });

        setTimeout(() => this.successMessage.set(null), 2500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al agregar docente(s).');
      }
    });
  }

  openRemoveTeachersModal(): void {
    this.selectedTeachersToRemove.set([]);
    this.removeTeachersSearchQuery.set('');
    this.showRemoveTeachersModal.set(true);
  }

  closeRemoveTeachersModal(): void {
    this.showRemoveTeachersModal.set(false);
  }

  toggleTeacherToRemove(teacherId: string): void {
    const current = [...this.selectedTeachersToRemove()];
    const index = current.indexOf(teacherId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(teacherId);
    }
    this.selectedTeachersToRemove.set(current);
  }

  isTeacherSelectedToRemove(teacherId: string): boolean {
    return this.selectedTeachersToRemove().includes(teacherId);
  }

  submitRemoveTeachers(): void {
    const spaceId = this.selectedSpace()?.id;
    if (!spaceId) return;

    const toRemove = this.selectedTeachersToRemove();
    if (toRemove.length === 0) return;

    Swal.fire({
      title: '¿Desvincular Docentes?',
      text: `¿Estás seguro de que deseas desvincular a los ${toRemove.length} docente(s) seleccionado(s) del espacio físico actual?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desvincular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.modalLoading.set(true);
        this.errorMessage.set(null);

        // Obtener responsables actuales
        const currentResponsibleIds = this.selectedSpace()?.responsibleTeachers?.map((t: any) => t.id) || [];
        // Filtrar quitando los seleccionados para remover
        const removeSet = new Set(toRemove);
        const newResponsibleIds = currentResponsibleIds.filter(id => !removeSet.has(id));

        this.spacesService.linkTeachers(spaceId, newResponsibleIds).subscribe({
          next: () => {
            this.modalLoading.set(false);
            this.successMessage.set('Docente(s) desvinculado(s) correctamente.');
            this.closeRemoveTeachersModal();

            // Recargar los espacios y actualizar el espacio seleccionado para el modal de detalles
            this.spacesService.getAllSpaces().subscribe((res) => {
              this.spaces.set(res);
              const updated = res.find((s) => s.id === spaceId);
              if (updated) {
                this.selectedSpace.set(updated);

                // Sincronizar el formulario base de Angular
                const group: any = {};
                this.teachers().forEach((t: any) => {
                  const isLinked = updated.responsibleTeachers?.some((rt: any) => rt.id === t.id) || false;
                  group[t.id] = [isLinked];
                });
                this.teachersForm = this.fb.group(group);
              }
            });

            setTimeout(() => this.successMessage.set(null), 2500);
          },
          error: (err: any) => {
            this.modalLoading.set(false);
            this.errorMessage.set(err.error?.message || 'Error al desvincular docente(s).');
          }
        });
      }
    });
  }


  // Gestión de inventario temporal
  addTempItem(): void {
    if (this.inventoryForm.invalid) return;

    const formVal = this.inventoryForm.value;
    const itemId = formVal.selectedItemId;
    const qty = Number(formVal.assignQuantity);

    if (isNaN(qty) || qty < 1) {
      Swal.fire({
        title: 'Cantidad inválida',
        text: 'La cantidad debe ser mayor o igual a 1.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (!itemId) return;

    const itemObj = this.inventoryItems().find((i) => i.id === itemId);
    if (!itemObj) return;

    const maxStock = Number(itemObj.cantidad || 1);

    // Verificar si ya está en la lista temporal para calcular el stock restante real
    const current = [...this.assignedItemsTemp()];
    const existingIndex = current.findIndex((i) => i.itemId === itemId);
    const alreadyAssignedQty = existingIndex > -1 ? current[existingIndex].cantidad : 0;

    const totalTargetQty = alreadyAssignedQty + qty;

    if (totalTargetQty > maxStock) {
      Swal.fire({
        title: 'Stock Insuficiente',
        text: `No puedes asignar más del stock disponible. Stock máximo de "${itemObj.name}": ${maxStock}. Ya has agregado ${alreadyAssignedQty} a la lista temporal.`,
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

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

    this.assignedItemsTemp.set(current);
    this.inventoryForm.patchValue({
      selectedItemId: '',
      assignQuantity: 1
    });
  }

  removeTempItem(index: number): void {
    const current = [...this.assignedItemsTemp()];
    current.splice(index, 1);
    this.assignedItemsTemp.set(current);
  }

  onInventorySubmit(): void {
    const spaceId = this.selectedSpace()?.id;
    if (!spaceId) return;

    // Validar que para insumos la cantidad asignada no exceda el stock real en bodega
    for (const assigned of this.assignedItemsTemp()) {
      // Si el ítem ya estaba previamente asignado, no lo validamos contra el stock restante de bodega
      const isPreExisting = this.selectedSpace()?.items?.some((i: any) => i.id === assigned.itemId);
      if (isPreExisting) continue;

      const originalItem = this.inventoryItems().find((i) => i.id === assigned.itemId);
      if (originalItem && originalItem.inventoryView?.code === 'INSUMOS') {
        const maxStock = Number(originalItem.cantidad || 0);
        if (assigned.cantidad > maxStock) {
          Swal.fire({
            title: 'Cantidad Excedida',
            text: `No puedes asignar ${assigned.cantidad} unidades del insumo "${assigned.name}" porque el stock máximo disponible en bodega es de ${maxStock} unidades.`,
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          return;
        }
      }
    }

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const payloadItems = this.assignedItemsTemp().map((i) => ({
      itemId: i.itemId,
      cantidad: i.cantidad
    }));

    this.spacesService.assignItems(spaceId, payloadItems).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Inventario del espacio actualizado correctamente.');
        
        // Recargar inventario y espacios para refrescar la vista en tiempo real
        this.loadInventoryItems(this.itemSearchQuery(), this.selectedFilterView());
        this.spacesService.getAllSpaces().subscribe((res) => {
          this.spaces.set(res);
          const updated = res.find((s) => s.id === spaceId);
          if (updated) {
            this.selectedSpace.set(updated);
            const newAssigned = updated.items?.map((item: any) => ({
              itemId: item.id,
              name: item.name,
              codeValue: item.codigoYavirac || item.codeValue || '',
              cantidad: item.cantidad || 1
            })) || [];
            this.assignedItemsTemp.set(newAssigned);
          }
        });

        setTimeout(() => {
          this.successMessage.set(null);
          if (!this.showDetailModal()) {
            this.closeInventoryModal();
          }
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al asignar inventario.');
      }
    });
  }

  unassignItemFromSpace(item: any): void {
    const spaceId = this.selectedSpace()?.id;
    if (!spaceId) return;

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    this.spacesService.removeItem(spaceId, item.id).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set(`Artículo "${item.name}" desvinculado del espacio correctamente.`);

        // Actualizar lista temporal desmarcando el ítem
        const updatedTemp = this.assignedItemsTemp().filter((i) => i.itemId !== item.id);
        this.assignedItemsTemp.set(updatedTemp);

        // Recargar inventario de espacios
        this.loadInventoryItems(this.itemSearchQuery(), this.selectedFilterView());
        this.spacesService.getAllSpaces().subscribe((res) => {
          this.spaces.set(res);
          const updated = res.find((s) => s.id === spaceId);
          if (updated) {
            this.selectedSpace.set(updated);
          }
        });

        setTimeout(() => this.successMessage.set(null), 2500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al desvincular el artículo.');
      }
    });
  }


  // Filtrar ítems elegibles (Disponibles o Asignados a este Espacio)
  filteredInventoryItems = computed(() => {
    return this.inventoryItems();
  });

  // Categorías filtradas para el tab de Inventario Asignado (según vista activa)
  assignedTabFilteredCategories = computed(() => {
    const viewId = this.selectedFilterView();
    const view = this.inventoryViews().find(v => v.id === viewId);
    const viewCode = view?.code || '';
    const cats = this.categories();
    if (!viewCode) return cats;
    return cats.filter((c: any) => c.baseView === viewCode);
  });

  // Subcategorías filtradas para el tab de Inventario Asignado (según categoría activa)
  assignedTabFilteredSubcategories = computed(() => {
    const catId = this.assignedTabCategory();
    const subs = this.subcategories();
    if (!catId) return subs;
    return subs.filter((s: any) => (s.categoriaId === catId || s.categoryId === catId));
  });

  // Ítems que YA pertenecen al espacio actual con todos los filtros aplicados (Vista, Categoría, Subcategoría, Búsqueda)
  assignedSpaceItems = computed(() => {
    const currentItems = this.selectedSpace()?.items || [];
    const filterViewId = this.selectedFilterView();
    const catId = this.assignedTabCategory();
    const subId = this.assignedTabSubcategory();
    const searchQuery = this.assignedTabSearchQuery().toLowerCase().trim();

    return currentItems.filter((item) => {
      // 1. Filtrar por Vista Físico/Virtual/Insumos/Biblioteca
      if (filterViewId) {
        const itemViewId = item.inventoryViewId || item.inventoryView?.id;
        if (itemViewId !== filterViewId) return false;
      }

      // 2. Filtrar por Categoría
      if (catId) {
        const itemCatId = item.subcategory?.categoryId || item.subcategory?.categoriaId || item.subcategory?.category?.id || item.subcategoria?.categoriaId || item.subcategoria?.categoria?.id;
        if (itemCatId !== catId) return false;
      }

      // 3. Filtrar por Subcategoría
      if (subId) {
        const itemSubId = item.subcategoryId || item.subcategoriaId || item.subcategory?.id || item.subcategoria?.id;
        if (itemSubId !== subId) return false;
      }

      // 4. Filtrar por Búsqueda (Código, Nombre, Categoría, Subcategoría)
      if (searchQuery) {
        const name = (item.name || item.dynamicValues?.['nombre'] || '').toLowerCase();
        const code = (item.codigoYavirac || item.codeValue || '').toLowerCase();
        const subName = (item.subcategoria?.nombre || item.subcategory?.name || '').toLowerCase();
        const catName = (item.subcategoria?.categoria?.nombre || item.subcategory?.category?.name || '').toLowerCase();

        const matches = name.includes(searchQuery) ||
                        code.includes(searchQuery) ||
                        subName.includes(searchQuery) ||
                        catName.includes(searchQuery);
        if (!matches) return false;
      }

      return true;
    });
  });

  // Ítems elegibles para ser asignados
  availableSpaceItems = computed(() => {
    const currentSpaceId = this.selectedSpace()?.id;
    const showUnavailable = this.showUnavailableItems();

    return this.filteredInventoryItems().filter((item) => {
      const itemSpaceId = item.physicalSpaceId || item.physicalSpace?.id;
      
      // Para insumos
      if (item.inventoryView?.code === 'INSUMOS') {
        const isBodega = !itemSpaceId;
        if (showUnavailable) {
          return isBodega && (item.cantidad ?? 0) <= 0; // Agotados en bodega
        }
        return isBodega && (item.cantidad ?? 0) > 0; // Con stock en bodega
      }

      // Para bienes y biblioteca
      if (showUnavailable) {
        // No disponibles: Asignados a otras aulas
        return itemSpaceId && itemSpaceId !== currentSpaceId;
      } else {
        // Disponibles: Sin asignar a ningún aula
        return !itemSpaceId;
      }
    });
  });

  updateItemSearch(val: string): void {
    this.assignedTabSearchQuery.set(val);
  }

  updateItemFilterView(viewId: string): void {
    this.selectedFilterView.set(viewId);
    this.assignedTabCategory.set('');
    this.assignedTabSubcategory.set('');
  }

  updateAssignedTabCategory(catId: string): void {
    this.assignedTabCategory.set(catId);
    this.assignedTabSubcategory.set('');
  }

  updateAssignedTabSubcategory(subId: string): void {
    this.assignedTabSubcategory.set(subId);
  }

  // Filtrar docentes activos por nombre, cédula o correo
  filteredTeachers = computed(() => {
    const query = this.teacherSearchQuery().toLowerCase().trim();
    const list = this.teachers();
    if (!query) return list;

    return list.filter((t) => {
      const fullname = `${t.nombres || ''} ${t.apellidos || ''}`.toLowerCase();
      const cedula = (t.cedula || '').toLowerCase();
      const email = (t.correoInstitucional || '').toLowerCase();
      return fullname.includes(query) || cedula.includes(query) || email.includes(query);
    });
  });

  filteredSpaceResponsibleTeachers = computed(() => {
    const space = this.selectedSpace();
    if (!space || !space.responsibleTeachers) return [];
    const query = this.responsibleTeachersSearchQuery().toLowerCase().trim();
    if (!query) return space.responsibleTeachers;
    return space.responsibleTeachers.filter((t: any) => {
      const fullname = `${t.nombres || ''} ${t.apellidos || ''}`.toLowerCase();
      const cedula = (t.cedula || '').toLowerCase();
      const email = (t.correoInstitucional || '').toLowerCase();
      return fullname.includes(query) || cedula.includes(query) || email.includes(query);
    });
  });

  availableTeachersToAdd = computed(() => {
    const space = this.selectedSpace();
    const allTeachers = this.teachers();
    if (!space) return allTeachers;
    const assignedIds = new Set(space.responsibleTeachers?.map((t: any) => t.id) || []);
    const filtered = allTeachers.filter((t: any) => !assignedIds.has(t.id));
    const query = this.addTeachersSearchQuery().toLowerCase().trim();
    if (!query) return filtered;
    return filtered.filter((t: any) => {
      const fullname = `${t.nombres || ''} ${t.apellidos || ''}`.toLowerCase();
      const cedula = (t.cedula || '').toLowerCase();
      const email = (t.correoInstitucional || '').toLowerCase();
      return fullname.includes(query) || cedula.includes(query) || email.includes(query);
    });
  });

  teachersToRemove = computed(() => {
    const space = this.selectedSpace();
    if (!space || !space.responsibleTeachers) return [];
    const query = this.removeTeachersSearchQuery().toLowerCase().trim();
    if (!query) return space.responsibleTeachers;
    return space.responsibleTeachers.filter((t: any) => {
      const fullname = `${t.nombres || ''} ${t.apellidos || ''}`.toLowerCase();
      const cedula = (t.cedula || '').toLowerCase();
      const email = (t.correoInstitucional || '').toLowerCase();
      return fullname.includes(query) || cedula.includes(query) || email.includes(query);
    });
  });

  updateTeacherSearch(val: string): void {
    this.teacherSearchQuery.set(val);
  }


  isItemAvailable(item: any): boolean {
    const itemSpaceId = item.physicalSpaceId || item.physicalSpace?.id;
    if (item.inventoryView?.code === 'INSUMOS') {
      return !itemSpaceId && (item.cantidad ?? 0) > 0;
    }
    return !itemSpaceId;
  }

  // ==========================================================
  // LÓGICA DE SELECCIÓN MULTI-CARD (INVENTARIO Y DOCENTES)
  // ==========================================================
  isItemSelected(itemId: string): boolean {
    return this.assignedItemsTemp().some((i) => i.itemId === itemId);
  }

  toggleItemSelection(item: any): void {
    if (!this.isItemAvailable(item)) return;

    const current = [...this.assignedItemsTemp()];
    const index = current.findIndex((i) => i.itemId === item.id);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push({
        itemId: item.id,
        name: item.name || item.dynamicValues?.['nombre'] || 'Artículo',
        codeValue: item.codigoYavirac || item.codeValue || '',
        cantidad: 1
      });
    }

    this.assignedItemsTemp.set(current);
  }

  newlySelectedItemsCount = computed(() => {
    const preExistingIds = new Set(this.selectedSpace()?.items?.map((i: any) => i.id) || []);
    return this.assignedItemsTemp().filter(i => !preExistingIds.has(i.itemId)).length;
  });

  preventInvalidQuantityKeys(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) {
      event.preventDefault();
    }
  }

  onQuantityInputChange(item: any, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    let parsed = parseInt(inputEl.value, 10);
    const maxStock = Number(item.cantidad || 9999);
    
    if (isNaN(parsed) || parsed < 1) {
      parsed = 1;
    } else if (parsed > maxStock) {
      parsed = maxStock;
    }

    inputEl.value = parsed.toString();
    this.setItemQuantity(item, parsed);
  }

  setItemQuantity(item: any, qty: number): void {
    const validQty = isNaN(qty) || qty < 1 ? 1 : qty;
    const current = [...this.assignedItemsTemp()];
    const index = current.findIndex((i) => i.itemId === item.id);
    if (index > -1) {
      current[index].cantidad = validQty;
      this.assignedItemsTemp.set(current);
    }
  }

  getItemQuantity(itemId: string): number {
    const found = this.assignedItemsTemp().find((i) => i.itemId === itemId);
    return found ? (found.cantidad || 1) : 1;
  }

  areAllVisibleItemsSelected = computed(() => {
    const visible = this.availableSpaceItems().filter((item) => this.isItemAvailable(item));
    if (visible.length === 0) return false;
    const temp = this.assignedItemsTemp();
    return visible.every((item) => temp.some((t) => t.itemId === item.id));
  });

  toggleSelectAllItems(): void {
    const visible = this.availableSpaceItems().filter((item) => this.isItemAvailable(item));
    if (visible.length === 0) return;

    let current = [...this.assignedItemsTemp()];
    const allSelected = this.areAllVisibleItemsSelected();

    if (allSelected) {
      const visibleIds = new Set(visible.map((v) => v.id));
      current = current.filter((i) => !visibleIds.has(i.itemId));
    } else {
      visible.forEach((item) => {
        if (!current.some((i) => i.itemId === item.id)) {
          current.push({
            itemId: item.id,
            name: item.name || item.dynamicValues?.['nombre'] || 'Artículo',
            codeValue: item.codigoYavirac || item.codeValue || '',
            cantidad: 1
          });
        }
      });
    }

    this.assignedItemsTemp.set(current);
  }

  isTeacherSelected(teacherId: string): boolean {
    return !!this.teachersForm.get(teacherId)?.value;
  }

  teachersToUnlink = computed(() => {
    const space = this.selectedSpace();
    if (!space || !space.responsibleTeachers) return [];
    return space.responsibleTeachers.filter(t => !this.isTeacherSelected(t.id));
  });

  unlinkSelectedTeachers(): void {
    const spaceId = this.selectedSpace()?.id;
    if (!spaceId) return;

    const toUnlink = this.teachersToUnlink();
    if (toUnlink.length === 0) return;

    Swal.fire({
      title: '¿Desvincular Docentes?',
      text: `¿Estás seguro de que deseas desvincular a los ${toUnlink.length} docentes desmarcados del espacio físico actual?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desvincular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.modalLoading.set(true);
        this.errorMessage.set(null);

        // Los docentes que quedan vinculados son los que tienen value = true en teachersForm
        const formVal = this.teachersForm.getRawValue();
        const activeTeacherIds = Object.keys(formVal).filter((id) => formVal[id]);

        this.spacesService.linkTeachers(spaceId, activeTeacherIds).subscribe({
          next: () => {
            this.modalLoading.set(false);
            this.successMessage.set('Docentes desvinculados correctamente.');

            // Recargar los espacios y actualizar el espacio seleccionado para el modal de detalles
            this.spacesService.getAllSpaces().subscribe((res) => {
              this.spaces.set(res);
              const updated = res.find((s) => s.id === spaceId);
              if (updated) {
                this.selectedSpace.set(updated);
                
                // Reinicializar el formulario reactivo
                const group: any = {};
                this.teachers().forEach((t: any) => {
                  const isLinked = updated.responsibleTeachers?.some((rt: any) => rt.id === t.id) || false;
                  group[t.id] = [isLinked];
                });
                this.teachersForm = this.fb.group(group);
              }
            });

            setTimeout(() => this.successMessage.set(null), 2500);
          },
          error: (err: any) => {
            this.modalLoading.set(false);
            this.errorMessage.set(err.error?.message || 'Error al desvincular docentes.');
          }
        });
      }
    });
  }

  toggleTeacherSelection(teacherId: string): void {
    const control = this.teachersForm.get(teacherId);
    if (control) {
      control.setValue(!control.value);
    }
  }

  areAllVisibleTeachersSelected = computed(() => {
    const visible = this.filteredTeachers();
    if (visible.length === 0) return false;
    return visible.every((t) => this.isTeacherSelected(t.id));
  });

  toggleSelectAllTeachers(): void {
    const visible = this.filteredTeachers();
    if (visible.length === 0) return;

    const shouldSelect = !this.areAllVisibleTeachersSelected();
    visible.forEach((t) => {
      const control = this.teachersForm.get(t.id);
      if (control) {
        control.setValue(shouldSelect);
      }
    });
  }

  isQuantityReadOnly(): boolean {
    const itemId = this.inventoryForm.get('selectedItemId')?.value;
    if (!itemId) return false;
    const itemObj = this.inventoryItems().find((i) => i.id === itemId);
    if (!itemObj) return false;
    const viewCode = itemObj.inventoryView?.code;
    return viewCode === 'BIENES_PUBLICOS' || viewCode === 'BIBLIOTECA';
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
