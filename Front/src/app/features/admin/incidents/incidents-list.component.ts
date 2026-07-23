import { Component, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { IncidentsService, IncidentReport } from '../../../core/services/incidents.service';
import { PeriodsService } from '../../../core/services/periods.service';
import { ReportsService, ReportItem } from '../../../core/services/reports.service';
import { InventorySyncService } from '../../../core/services/inventory-sync.service';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-incidents-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './incidents-list.component.html',
  styleUrl: './incidents-list.component.css'
})
export class IncidentsListComponent implements OnInit, OnDestroy {
  incidents = signal<IncidentReport[]>([]);
  periods = signal<any[]>([]);
  
  isLoading = signal(false);
  modalLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Tabs de control
  activeTab = signal<'incidents' | 'reports'>('incidents');

  // Propiedades de Reportes Consolidados
  reports = signal<ReportItem[]>([]);
  showGenerateModal = signal(false);
  showReportDetailModal = signal(false);
  selectedReport = signal<ReportItem | null>(null);
  selectedReportDetail = signal<any | null>(null);

  // Modales Incidencias
  showDetailModal = signal(false);
  selectedIncident = signal<IncidentReport | null>(null);

  // Formularios
  filterForm: FormGroup;
  reportFilterForm: FormGroup;
  generateForm: FormGroup;

  private syncSub?: Subscription;
  private pollTimer?: any;

  constructor(
    private readonly fb: FormBuilder,
    private readonly incidentsService: IncidentsService,
    private readonly periodsService: PeriodsService,
    private readonly reportsService: ReportsService,
    private readonly syncService: InventorySyncService
  ) {
    this.filterForm = this.fb.group({
      status: [''],
      academicPeriodId: ['']
    });

    this.filterForm.valueChanges.subscribe(() => {
      this.loadIncidents();
    });

    this.reportFilterForm = this.fb.group({
      academicPeriodId: ['']
    });

    this.reportFilterForm.valueChanges.subscribe(() => {
      this.loadReports();
    });

    this.generateForm = this.fb.group({
      academicPeriodId: ['']
    });
  }

  ngOnInit(): void {
    this.loadIncidents();
    this.loadReports();
    this.loadPeriods();

    // 1. Escuchar sincronización en tiempo real
    this.syncSub = this.syncService.events$.subscribe((type) => {
      if (type === 'INCIDENTS_CHANGED' || type === 'INVENTORY_CHANGED') {
        this.loadIncidents(true);
      }
    });

    // 2. Polling silencioso cada 8 segundos
    this.pollTimer = setInterval(() => {
      this.loadIncidents(true);
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.syncSub) this.syncSub.unsubscribe();
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  loadIncidents(silent: boolean = false): void {
    if (!silent) this.isLoading.set(true);
    const filters = this.filterForm.value;
    this.incidentsService.getAllIncidents(filters).subscribe({
      next: (res: IncidentReport[]) => {
        this.incidents.set(res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        if (!silent) this.isLoading.set(false);
      },
      error: (err: any) => {
        if (!silent) {
          this.errorMessage.set('Error al cargar reporte de novedades.');
          this.isLoading.set(false);
        }
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

  loadReports(): void {
    this.isLoading.set(true);
    const filters = this.reportFilterForm.value;
    this.reportsService.getReports(filters).subscribe({
      next: (res: ReportItem[]) => {
        const filtered = res.filter((r) => r.type === 'NOVEDADES');
        this.reports.set(filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.errorMessage.set('Error al cargar historial de reportes.');
        this.isLoading.set(false);
      }
    });
  }

  resetFilters(): void {
    this.filterForm.reset({
      status: '',
      academicPeriodId: ''
    });
  }

  resetReportFilters(): void {
    this.reportFilterForm.reset({
      academicPeriodId: ''
    });
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

  openReportDetailModal(report: ReportItem): void {
    this.selectedReport.set(report);
    this.selectedReportDetail.set(null);
    this.showReportDetailModal.set(true);

    this.reportsService.getReportDetails(report.id).subscribe({
      next: (res: any) => {
        this.selectedReportDetail.set(res);
      }
    });
  }

  closeReportDetailModal(): void {
    this.showReportDetailModal.set(false);
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
    if (type === 'NOVEDADES_CONSOLIDADO' || type === 'NOVEDADES') return 'Consolidado de Novedades';
    if (type === 'AUDITORIA_INVENTARIO') return 'Auditoría General';
    return type;
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

  getItemViewCode(itemObj: any): string {
    const item = itemObj?.item || itemObj;
    if (!item) return 'BIENES_PUBLICOS';
    const code = item.inventoryView?.code || item.viewCode || item.subcategory?.category?.inventoryView?.code || item.subcategoria?.categoria?.baseView;
    const name = item.view || item.inventoryView?.name || item.subcategory?.category?.inventoryView?.name || item.subcategory?.category?.name || '';
    
    if (code === 'BIENES_PUBLICOS' || name === 'Bienes Públicos') return 'BIENES_PUBLICOS';
    if (code === 'INSUMOS' || name === 'Insumos y Suministros' || name.toLowerCase().includes('insumo')) return 'INSUMOS';
    if (code === 'BIBLIOTECA' || name === 'Biblioteca') return 'BIBLIOTECA';
    
    const itemCode = item.codeValue || item.codigoYavirac || '';
    if (itemCode.startsWith('INS-')) return 'INSUMOS';
    if (itemCode.startsWith('BIB-')) return 'BIBLIOTECA';
    if (itemCode.startsWith('YAV-')) return 'BIENES_PUBLICOS';
    
    return code || 'BIENES_PUBLICOS';
  }

  getItemViewName(itemObj: any): string {
    const code = this.getItemViewCode(itemObj);
    if (code === 'BIENES_PUBLICOS') return 'Bienes Públicos';
    if (code === 'INSUMOS') return 'Insumos y Suministros';
    if (code === 'BIBLIOTECA') return 'Biblioteca';
    return 'Bienes Públicos';
  }
}
