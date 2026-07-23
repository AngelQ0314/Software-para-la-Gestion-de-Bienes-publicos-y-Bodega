import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RequestsService, InventoryRequest } from '../../../core/services/requests.service';
import { PeriodsService } from '../../../core/services/periods.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-requests-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './requests-list.component.html',
  styleUrl: './requests-list.component.css'
})
export class RequestsListComponent implements OnInit {
  requests = signal<InventoryRequest[]>([]);
  periods = signal<any[]>([]);
  
  isLoading = signal(false);
  modalLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Señales reactivas para los filtros locales instantáneos
  selectedStatus = signal<string>('');
  selectedPeriodId = signal<string>('');
  selectedType = signal<string>('');
  teacherSearch = signal<string>('');

  // Modales
  showDetailModal = signal(false);
  showRejectModal = signal(false);
  selectedRequest = signal<InventoryRequest | null>(null);

  // Formularios
  filterForm: FormGroup;
  rejectForm: FormGroup;

  // Lista filtrada de solicitudes calculada de forma instantánea
  filteredRequests = computed(() => {
    let list = this.requests();
    const status = this.selectedStatus();
    const periodId = this.selectedPeriodId();
    const type = this.selectedType();
    const search = this.teacherSearch().toLowerCase().trim();

    if (status) {
      list = list.filter((r) => r.status === status);
    }
    if (periodId) {
      list = list.filter((r) => r.academicPeriodId === periodId);
    }
    if (type) {
      list = list.filter((r) => r.type === type);
    }
    if (search) {
      list = list.filter((r) => {
        const teacherName = `${r.teacher?.nombres || ''} ${r.teacher?.apellidos || ''}`.toLowerCase();
        return teacherName.includes(search);
      });
    }
    return list;
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly requestsService: RequestsService,
    private readonly periodsService: PeriodsService
  ) {
    this.filterForm = this.fb.group({
      status: [''],
      academicPeriodId: [''],
      type: [''],
      teacherName: ['']
    });

    // Escuchar cambios reactivos en el formulario de filtros para auto-búsqueda inmediata
    this.filterForm.valueChanges.subscribe((val) => {
      this.selectedStatus.set(val.status || '');
      this.selectedPeriodId.set(val.academicPeriodId || '');
      this.selectedType.set(val.type || '');
      this.teacherSearch.set(val.teacherName || '');
    });

    this.rejectForm = this.fb.group({
      rejectionReason: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  ngOnInit(): void {
    this.loadRequests();
    this.loadPeriods();
  }

  loadRequests(): void {
    this.isLoading.set(true);
    this.requestsService.getAllRequests().subscribe({
      next: (res: InventoryRequest[]) => {
        this.requests.set(res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.errorMessage.set('Error al cargar solicitudes.');
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

  resetFilters(): void {
    this.filterForm.reset({
      status: '',
      academicPeriodId: '',
      type: '',
      teacherName: ''
    });
  }

  openDetailModal(req: InventoryRequest): void {
    this.selectedRequest.set(req);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
  }

  openRejectModal(req: InventoryRequest): void {
    this.selectedRequest.set(req);
    this.rejectForm.reset({ rejectionReason: '' });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showRejectModal.set(true);
  }

  closeRejectModal(): void {
    this.showRejectModal.set(false);
  }

  approveRequest(req: InventoryRequest): void {
    Swal.fire({
      title: '¿Aprobar solicitud?',
      text: 'Esto actualizará automáticamente el stock en bodega, asignará los artículos al aula y generará el acta PDF.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f97316',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'Aprobando solicitud...',
          text: 'Por favor, espere un momento.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        this.requestsService.approveRequest(req.id).subscribe({
          next: (res: any) => {
            Swal.fire({
              title: '¡Aprobada!',
              text: res.message || 'Solicitud aprobada exitosamente y acta generada.',
              icon: 'success',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#f97316'
            });

            // Actualizar reactivamente el estado en el modal abierto
            this.selectedRequest.set({
              ...req,
              status: 'APROBADA'
            });

            this.loadRequests();
          },
          error: (err: any) => {
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'Error al aprobar la solicitud.',
              icon: 'error',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#f43f5e'
            });
          }
        });
      }
    });
  }

  onRejectSubmit(): void {
    if (this.rejectForm.invalid) return;
    const req = this.selectedRequest();
    if (!req) return;

    this.modalLoading.set(true);
    this.errorMessage.set(null);

    const reason = this.rejectForm.value.rejectionReason.trim();

    this.requestsService.rejectRequest(req.id, reason).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.successMessage.set('Solicitud rechazada correctamente.');
        
        // Actualizar reactivamente el estado en el modal abierto
        this.selectedRequest.set({
          ...req,
          status: 'RECHAZADA',
          rejectionReason: reason
        });

        setTimeout(() => {
          this.closeRejectModal();
          this.loadRequests();
        }, 1500);
      },
      error: (err: any) => {
        this.modalLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al rechazar solicitud.');
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
          confirmButtonColor: '#f43f5e'
        });
      }
    });
  }

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
