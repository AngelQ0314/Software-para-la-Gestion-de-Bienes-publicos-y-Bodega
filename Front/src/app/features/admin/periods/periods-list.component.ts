import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeriodsService, AcademicPeriod } from '../../../core/services/periods.service';
import { ReportsService } from '../../../core/services/reports.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-periods-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './periods-list.component.html',
  styleUrl: './periods-list.component.css'
})
export class PeriodsListComponent implements OnInit {
  periods = signal<AcademicPeriod[]>([]);
  isLoading = signal(false);
  modalLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modal
  showCreateModal = signal(false);
  periodForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly periodsService: PeriodsService,
    private readonly reportsService: ReportsService
  ) {
    this.periodForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadPeriods();
  }

  loadPeriods(): void {
    this.isLoading.set(true);
    this.periodsService.getAllPeriods().subscribe({
      next: (res: AcademicPeriod[]) => {
        // Ordenar: primero activos, luego configurados, luego cerrados
        this.periods.set(res.sort((a, b) => {
          if (a.status === 'ACTIVO') return -1;
          if (b.status === 'ACTIVO') return 1;
          if (a.status === 'CONFIGURADO') return -1;
          if (b.status === 'CONFIGURADO') return 1;
          return 0;
        }));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.errorMessage.set('Error al cargar períodos académicos.');
        this.isLoading.set(false);
      }
    });
  }

  openCreateModal(): void {
    this.periodForm.reset({
      name: '',
      startDate: '',
      endDate: ''
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  onCreateSubmit(): void {
    if (this.periodForm.invalid) return;

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const val = this.periodForm.value;
    const start = new Date(val.startDate);
    const end = new Date(val.endDate);

    if (start >= end) {
      this.errorMessage.set('La fecha de finalización debe ser posterior a la fecha de inicio.');
      this.modalLoading.set(false);
      return;
    }

    const payload = {
      name: val.name.trim().toUpperCase(),
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };

    this.periodsService.createPeriod(payload).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Período académico configurado con éxito.');
        setTimeout(() => {
          this.closeCreateModal();
          this.loadPeriods();
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al registrar período académico.');
      }
    });
  }

  activatePeriod(period: AcademicPeriod): void {
    Swal.fire({
      title: '¿Activar Período Académico?',
      text: `¿Estás seguro de que deseas ACTIVAR el período "${period.name}"? Esta acción incorporará automáticamente todo el inventario pendiente registrado fuera del período.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, activar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading.set(true);
        this.periodsService.activatePeriod(period.id).subscribe({
          next: (res: any) => {
            Swal.fire({
              title: '¡Activado!',
              text: res.message || 'Período activado exitosamente.',
              icon: 'success',
              confirmButtonText: 'Aceptar'
            });
            this.loadPeriods();
          },
          error: (err: any) => {
            this.isLoading.set(false);
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'Error al activar el período.',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }

  closePeriod(period: AcademicPeriod): void {
    Swal.fire({
      title: '¿Cerrar Período Académico?',
      text: `¿Estás seguro de que deseas CERRAR manualmente el período "${period.name}"? Esta acción archivará los inventarios e incidencias y no podrán realizarse más modificaciones.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar período',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading.set(true);
        this.periodsService.closePeriod(period.id).subscribe({
          next: (res: any) => {
            Swal.fire({
              title: '¡Cerrado!',
              text: res.message || 'Período cerrado exitosamente y reporte consolidado generado.',
              icon: 'success',
              confirmButtonText: 'Aceptar'
            });
            this.loadPeriods();
          },
          error: (err: any) => {
            this.isLoading.set(false);
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'Error al cerrar el período.',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }


  downloadClosureReport(periodId: string): void {
    Swal.fire({
      title: 'Cargando reporte...',
      text: 'Recuperando el reporte oficial consolidado de cierre de período académico.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.reportsService.getClosureReport(periodId).subscribe({
      next: (report: any) => {
        if (report && report.id) {
          this.reportsService.downloadReportPdf(report.id).subscribe({
            next: (blob: Blob) => {
              Swal.close();
              const blobUrl = URL.createObjectURL(blob);
              window.open(blobUrl, '_blank');
            },
            error: () => {
              Swal.close();
              Swal.fire({
                title: 'Error',
                text: 'No se pudo descargar el archivo PDF consolidado.',
                icon: 'error',
                confirmButtonText: 'Aceptar'
              });
            }
          });
        } else {
          Swal.close();
          Swal.fire({
            title: 'Información',
            text: 'No se ha encontrado el reporte de cierre para este período.',
            icon: 'info',
            confirmButtonText: 'Aceptar'
          });
        }
      },
      error: (err: any) => {
        Swal.close();
        Swal.fire({
          title: 'Error',
          text: err.error?.message || 'No se pudo recuperar el reporte de cierre del período.',
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  formatStatus(status: string): string {
    if (status === 'CONFIGURADO') return 'Configurado';
    if (status === 'ACTIVO') return 'Activo';
    if (status === 'CERRADO') return 'Cerrado';
    return status;
  }
}
