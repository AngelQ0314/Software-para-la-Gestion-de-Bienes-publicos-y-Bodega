import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IncidentsService, IncidentReport } from '../../../core/services/incidents.service';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';

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
  
  // Señal reactiva para vincular la reevaluación de jornadas
  selectedSpaceId = signal<string>('');
  
  // Bienes del espacio en jornada seleccionada
  availableItems = signal<any[]>([]);
  selectedItemIds = signal<string[]>([]);

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

  constructor(
    private readonly fb: FormBuilder,
    private readonly incidentsService: IncidentsService,
    private readonly spacesService: SpacesService
  ) {
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
  }

  loadMyIncidents(): void {
    this.isLoading.set(true);
    this.incidentsService.getAllIncidents().subscribe({
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

  toggleItemSelection(itemId: string): void {
    const current = [...this.selectedItemIds()];
    const index = current.indexOf(itemId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(itemId);
    }
    this.selectedItemIds.set(current);
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
    const payload = {
      spaceId: val.spaceId,
      jornada: val.jornada,
      description: val.description.trim(),
      itemIds: this.selectedItemIds(),
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
