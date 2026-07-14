import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IncidentsService, IncidentReport } from '../../../core/services/incidents.service';
import { PeriodsService } from '../../../core/services/periods.service';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-incidents-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './incidents-list.component.html',
  styleUrl: './incidents-list.component.css'
})
export class IncidentsListComponent implements OnInit {
  incidents = signal<IncidentReport[]>([]);
  periods = signal<any[]>([]);
  
  isLoading = signal(false);
  modalLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modales
  showDetailModal = signal(false);
  selectedIncident = signal<IncidentReport | null>(null);

  // Formularios
  filterForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly incidentsService: IncidentsService,
    private readonly periodsService: PeriodsService
  ) {
    this.filterForm = this.fb.group({
      status: [''],
      academicPeriodId: ['']
    });
  }

  ngOnInit(): void {
    this.loadIncidents();
    this.loadPeriods();
  }

  loadIncidents(): void {
    this.isLoading.set(true);
    const filters = this.filterForm.value;
    this.incidentsService.getAllIncidents(filters).subscribe({
      next: (res: IncidentReport[]) => {
        this.incidents.set(res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.errorMessage.set('Error al cargar reporte de novedades.');
        this.isLoading.set(false);
      }
    });
  }

  loadPeriods(): void {
    this.periodsService.getAllPeriods().subscribe({
      next: (res: any[]) => {
        this.periods.set(res);
      }
    });
  }

  applyFilters(): void {
    this.loadIncidents();
  }

  resetFilters(): void {
    this.filterForm.reset({
      status: '',
      academicPeriodId: ''
    });
    this.loadIncidents();
  }

  openDetailModal(incident: IncidentReport): void {
    this.selectedIncident.set(incident);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
  }

  updateStatus(incident: IncidentReport, status: 'PENDIENTE' | 'REVISADO' | 'RESUELTO'): void {
    const statusText = this.formatStatus(status);
    
    Swal.fire({
      title: '¿Confirmar actualización?',
      text: `¿Estás seguro de que deseas actualizar el estado de este reporte a "${statusText}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#fb7185',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading.set(true);
        this.incidentsService.updateIncidentStatus(incident.id, status).subscribe({
          next: () => {
            this.isLoading.set(false);
            Swal.fire({
              title: '¡Actualizado!',
              text: 'El estado de la novedad se ha actualizado correctamente.',
              icon: 'success',
              confirmButtonText: 'Aceptar'
            });
            this.closeDetailModal();
            this.loadIncidents();
          },
          error: (err: any) => {
            this.isLoading.set(false);
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'Error al actualizar el estado.',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
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
