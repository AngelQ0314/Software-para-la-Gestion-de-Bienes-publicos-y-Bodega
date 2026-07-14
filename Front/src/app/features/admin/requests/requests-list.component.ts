import { Component, signal, OnInit } from '@angular/core';
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

  // Modales
  showDetailModal = signal(false);
  showRejectModal = signal(false);
  selectedRequest = signal<InventoryRequest | null>(null);

  // Formularios
  filterForm: FormGroup;
  rejectForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly requestsService: RequestsService,
    private readonly periodsService: PeriodsService
  ) {
    this.filterForm = this.fb.group({
      status: [''],
      academicPeriodId: [''],
      startDate: [''],
      endDate: ['']
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
    const filters = this.filterForm.value;
    
    // Parse dates to ISO if selected
    const parsedFilters = { ...filters };
    if (filters.startDate) parsedFilters.startDate = new Date(filters.startDate).toISOString();
    if (filters.endDate) parsedFilters.endDate = new Date(filters.endDate).toISOString();

    this.requestsService.getAllRequests(parsedFilters).subscribe({
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

  applyFilters(): void {
    this.loadRequests();
  }

  resetFilters(): void {
    this.filterForm.reset({
      status: '',
      academicPeriodId: '',
      startDate: '',
      endDate: ''
    });
    this.loadRequests();
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
    return type === 'TRANSFERENCIA' ? 'Transferencia' : 'Nuevo Inventario';
  }

  formatStatus(status: string): string {
    if (status === 'EN_PROCESO') return 'En Proceso';
    if (status === 'APROBADA') return 'Aprobada';
    if (status === 'RECHAZADA') return 'Rechazada';
    return status;
  }
}
