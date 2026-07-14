import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ReportsService, ReportItem } from '../../../core/services/reports.service';
import { PeriodsService } from '../../../core/services/periods.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-reports-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reports-list.component.html',
  styleUrl: './reports-list.component.css'
})
export class ReportsListComponent implements OnInit {
  reports = signal<ReportItem[]>([]);
  activeNovelties = signal<any[]>([]);
  periods = signal<any[]>([]);
  
  isLoading = signal(false);
  modalLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Modales
  showGenerateModal = signal(false);
  showDetailModal = signal(false);
  selectedReport = signal<ReportItem | null>(null);
  selectedReportDetail = signal<any | null>(null);

  // Formularios
  filterForm: FormGroup;
  generateForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportsService: ReportsService,
    private readonly periodsService: PeriodsService
  ) {
    this.filterForm = this.fb.group({
      type: [''],
      academicPeriodId: ['']
    });

    this.generateForm = this.fb.group({
      academicPeriodId: ['']
    });
  }

  ngOnInit(): void {
    this.loadReports();
    this.loadActiveNovelties();
    this.loadPeriods();
  }

  loadReports(): void {
    this.isLoading.set(true);
    const filters = this.filterForm.value;
    this.reportsService.getReports(filters).subscribe({
      next: (res: ReportItem[]) => {
        const filtered = res.filter((r) => r.type !== 'CIERRE_PERIODO' && r.type !== 'PERIODO_ACADEMICO');
        this.reports.set(filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.errorMessage.set('Error al cargar historial de reportes.');
        this.isLoading.set(false);
      }
    });
  }

  loadActiveNovelties(): void {
    this.reportsService.getActiveNovelties().subscribe({
      next: (res: any[]) => {
        this.activeNovelties.set(res);
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
    this.loadReports();
  }

  resetFilters(): void {
    this.filterForm.reset({
      type: '',
      academicPeriodId: ''
    });
    this.loadReports();
  }

  openGenerateModal(): void {
    this.generateForm.reset({ academicPeriodId: '' });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showGenerateModal.set(true);
  }

  closeGenerateModal(): void {
    this.showGenerateModal.set(false);
  }

  openDetailModal(report: ReportItem): void {
    this.selectedReport.set(report);
    this.selectedReportDetail.set(null);
    this.showDetailModal.set(true);

    this.reportsService.getReportDetails(report.id).subscribe({
      next: (res: any) => {
        this.selectedReportDetail.set(res);
      }
    });
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
  }

  onGenerateSubmit(): void {
    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const periodId = this.generateForm.value.academicPeriodId || undefined;

    this.reportsService.generateNoveltyReport(periodId).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Reporte consolidado de novedades generado.');
        setTimeout(() => {
          this.closeGenerateModal();
          this.loadReports();
          this.loadActiveNovelties();
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al generar reporte.');
      }
    });
  }

  downloadReport(report: ReportItem): void {
    Swal.fire({
      title: 'Generando archivo...',
      text: 'Recuperando el reporte oficial PDF de la base de datos.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.reportsService.downloadReportPdf(report.id).subscribe({
      next: (blob: Blob) => {
        Swal.close();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      },
      error: (err: any) => {
        Swal.close();
        Swal.fire({
          title: 'Error',
          text: 'No se pudo descargar el archivo PDF. Asegúrate de tener permisos necesarios.',
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  formatType(type: string): string {
    if (type === 'CIERRE_PERIODO') return 'Cierre de Período Académico';
    if (type === 'NOVEDADES_CONSOLIDADO') return 'Consolidado de Novedades';
    if (type === 'AUDITORIA_INVENTARIO') return 'Auditoría General';
    return type;
  }

  formatJornada(jornada: string): string {
    if (jornada === 'MATUTINA') return 'Matutina';
    if (jornada === 'VESPERTINA') return 'Vespertina';
    if (jornada === 'NOCTURNA') return 'Nocturna';
    return jornada;
  }
}
