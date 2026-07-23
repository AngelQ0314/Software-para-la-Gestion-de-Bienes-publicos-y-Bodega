import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Request } from './entities/request.entity';

@Injectable()
export class PdfGeneratorService {
  async generateHandoverActPdf(request: Request, actCode: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Asegurar que exista la carpeta destino
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const writeStream = fs.createWriteStream(outputPath);
        
        doc.pipe(writeStream);

        // --- ENCABEZADO ---
        doc.fillColor('#1a3a5c')
           .fontSize(16)
           .text('INSTITUTO SUPERIOR TECNOLÓGICO YAVIRAC', { align: 'center', underline: true })
           .moveDown(0.2);
           
        doc.fontSize(10)
           .fillColor('#555555')
           .text('Sistema de Gestión de Bienes Públicos y Bodega', { align: 'center' })
           .moveDown(1.5);

        // --- TÍTULO DINÁMICO DEL DOCUMENTO ---
        let tituloActa = 'ACTA DE ENTREGA - RECEPCIÓN DE BIENES E INSUMOS';
        let entregadoPorLabel = 'Entregado por:';
        let recibidoPorLabel = 'Recibido por (Docente):';

        const resolvedBy = request.resolvedBy 
          ? `${request.resolvedBy.nombres || ''} ${request.resolvedBy.apellidos || ''}`.trim()
          : 'Administrador de Bodega';

        const teacher = `${request.teacher.nombres || ''} ${request.teacher.apellidos || ''}`.trim();
        const cedula = request.teacher.cedula || 'N/A';
        const spaceName = request.space?.name || 'N/A';
        const roomNumber = request.space?.roomNumber || 'N/A';
        const periodName = request.academicPeriod?.name || 'N/A';
        const resolvedAt = request.resolvedAt ? request.resolvedAt.toLocaleString('es-EC') : new Date().toLocaleString('es-EC');

        let entregadoPorNombre = resolvedBy;
        let recibidoPorNombre = `${teacher} (C.I. ${cedula})`;

        let firmaEntregadoLabel = 'Entregado por (Firma)';
        let firmaRecibidoLabel = 'Recibido por (Firma)';
        let firmaEntregadoNombre = resolvedBy;
        let firmaRecibidoNombre = teacher;

        const type = request.type;

        if (type === 'NUEVO_INVENTARIO') {
          tituloActa = 'ACTA DE ENTREGA - RECEPCIÓN DE BIENES (BODEGA A AULA)';
          entregadoPorLabel = 'Entregado por (Bodega):';
          recibidoPorLabel = 'Recibido por (Docente):';
        } else if (type === 'TRASPASO_DOCENTE') {
          tituloActa = 'ACTA DE TRASPASO DE BIENES (ENTRE DOCENTES)';
          const destTeacher = request.destinationTeacher 
            ? `${request.destinationTeacher.nombres || ''} ${request.destinationTeacher.apellidos || ''}`.trim()
            : 'Docente Destinatario';
          const destCedula = request.destinationTeacher?.cedula || 'N/A';
          
          entregadoPorLabel = 'Entregado por (Docente Origen):';
          recibidoPorLabel = 'Recibido por (Docente Destino):';
          
          entregadoPorNombre = `${teacher} (C.I. ${cedula})`;
          recibidoPorNombre = `${destTeacher} (C.I. ${destCedula})`;
          
          firmaEntregadoLabel = 'Entregado por (Docente Origen)';
          firmaRecibidoLabel = 'Recibido por (Docente Destino)';
          firmaEntregadoNombre = teacher;
          firmaRecibidoNombre = destTeacher;
        } else if (type === 'TRANSFERENCIA_AULAS') {
          tituloActa = 'ACTA DE TRANSFERENCIA DE BIENES (ENTRE AULAS)';
          entregadoPorLabel = 'Responsable de la Transferencia:';
          recibidoPorLabel = 'Docente Custodio:';
          
          entregadoPorNombre = `${teacher} (C.I. ${cedula})`;
          recibidoPorNombre = `${teacher} (C.I. ${cedula})`;
          
          firmaEntregadoLabel = 'Docente Responsable (Origen)';
          firmaRecibidoLabel = 'Docente Responsable (Destino)';
          firmaEntregadoNombre = teacher;
          firmaRecibidoNombre = teacher;
        } else if (type === 'SOLICITUD_EXTERNA') {
          tituloActa = 'ACTA DE TRANSFERENCIA EXTERNA (AULA AJENA A MI AULA)';
          entregadoPorLabel = 'Entregado por (Aula Origen):';
          recibidoPorLabel = 'Recibido por (Docente Solicitante):';
          
          entregadoPorNombre = `Aula Origen ${roomNumber} (A cargo de: ${request.space?.responsibleTeachers?.map((t: any) => `${t.nombres} ${t.apellidos || ''}`).join(', ') || 'Docente Origen'})`;
          recibidoPorNombre = `${teacher} (C.I. ${cedula})`;
          
          firmaEntregadoLabel = 'Entregado por (Aula Origen)';
          firmaRecibidoLabel = 'Recibido por (Docente Solicitante)';
          firmaEntregadoNombre = request.space?.responsibleTeachers?.[0] 
            ? `${request.space.responsibleTeachers[0].nombres} ${request.space.responsibleTeachers[0].apellidos || ''}`.trim()
            : 'Responsable de Aula Origen';
          firmaRecibidoNombre = teacher;
        } else if (type === 'DEVOLUCION_BODEGA') {
          tituloActa = 'ACTA DE DEVOLUCIÓN DE BIENES A BODEGA';
          entregadoPorLabel = 'Entregado por (Docente):';
          recibidoPorLabel = 'Recibido por (Bodega):';
          
          entregadoPorNombre = `${teacher} (C.I. ${cedula})`;
          recibidoPorNombre = resolvedBy;
          
          firmaEntregadoLabel = 'Entregado por (Docente)';
          firmaRecibidoLabel = 'Recibido por (Bodega)';
          firmaEntregadoNombre = teacher;
          firmaRecibidoNombre = resolvedBy;
        } else if (type === 'BAJA_DEFINITIVA') {
          tituloActa = 'ACTA DE BAJA DEFINITIVA DE BIENES';
          entregadoPorLabel = 'Entregado por (Docente):';
          recibidoPorLabel = 'Procesado por (Administrador):';
          
          entregadoPorNombre = `${teacher} (C.I. ${cedula})`;
          recibidoPorNombre = resolvedBy;
          
          firmaEntregadoLabel = 'Entregado por (Docente)';
          firmaRecibidoLabel = 'Recibido por (Administración)';
          firmaEntregadoNombre = teacher;
          firmaRecibidoNombre = resolvedBy;
        } else if (type === 'MANTENIMIENTO') {
          tituloActa = 'ACTA DE RETIRO PARA MANTENIMIENTO TÉCNICO';
          entregadoPorLabel = 'Entregado por (Docente Custodio):';
          recibidoPorLabel = 'Recibido por (Soporte/Bodega):';
          
          entregadoPorNombre = `${teacher} (C.I. ${cedula})`;
          recibidoPorNombre = resolvedBy;
          
          firmaEntregadoLabel = 'Entregado por (Docente)';
          firmaRecibidoLabel = 'Recibido por (Soporte/Bodega)';
          firmaEntregadoNombre = teacher;
          firmaRecibidoNombre = resolvedBy;
        }

        doc.fillColor('#2c3e50')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(tituloActa, { align: 'center' })
           .font('Helvetica')
           .moveDown(0.2);
           
        doc.fontSize(11)
           .text(`CÓDIGO: ${actCode}`, { align: 'center' })
           .moveDown(1.5);

        // --- SECCIÓN 1: DATOS DE LA ENTREGA ---
        doc.fillColor('#1a3a5c')
           .fontSize(12)
           .text('1. Datos de la Entrega', { underline: true })
           .moveDown(0.5);

        doc.fillColor('#333333')
           .fontSize(10);

        doc.text(`${entregadoPorLabel} ${entregadoPorNombre}`)
           .text(`${recibidoPorLabel} ${recibidoPorNombre}`);

        if (request.destinationSpace) {
          const destSpaceName = request.destinationSpace.name || 'N/A';
          const destRoomNumber = request.destinationSpace.roomNumber || 'N/A';
          doc.text(`Espacio Físico Origen: ${spaceName} (Número ${roomNumber})`)
             .text(`Espacio Físico Destino: ${destSpaceName} (Número ${destRoomNumber})`);
        } else {
          if (type === 'DEVOLUCION_BODEGA' || type === 'BAJA_DEFINITIVA' || type === 'MANTENIMIENTO') {
            doc.text(`Espacio Físico Origen: ${spaceName} (Número ${roomNumber})`)
               .text(`Espacio Físico Destino: Bodega General / Stock Libre`);
          } else {
            doc.text(`Espacio Físico Destino: ${spaceName} (Número ${roomNumber})`);
          }
        }

        doc.text(`Período Académico: ${periodName}`)
           .text(`Fecha de Atención: ${resolvedAt}`)
           .text(`Justificación/Motivo: ${request.motive || 'Sin justificación'}`)
           .moveDown(1.5);

        // --- SECCIÓN 2: DETALLE DE ARTÍCULOS ---
        doc.fillColor('#1a3a5c')
           .fontSize(12)
           .text('2. Detalle de Bienes y/o Insumos Entregados', { underline: true })
           .moveDown(0.5);

        // Tabla: Encabezado
        const tableTop = doc.y;
        doc.fillColor('#1a3a5c')
           .fontSize(10)
           .text('Nº', 50, tableTop, { width: 30 })
           .text('Código Único / Barra', 80, tableTop, { width: 140 })
           .text('Nombre del Artículo', 230, tableTop, { width: 180 })
           .text('Cantidad', 420, tableTop, { width: 60, align: 'right' });

        // Línea divisoria
        doc.moveTo(50, tableTop + 15)
           .lineTo(550, tableTop + 15)
           .stroke('#1a3a5c')
           .moveDown(0.8);

        doc.fillColor('#333333');
        let currentY = tableTop + 25;
        let counter = 1;

        for (const itemRequest of request.items) {
          doc.text(`${counter}`, 50, currentY, { width: 30 })
             .text(`${itemRequest.item?.codeValue || 'SIN CÓDIGO'}`, 80, currentY, { width: 140 })
             .text(`${itemRequest.item?.name || 'N/A'}`, 230, currentY, { width: 180 })
             .text(`${itemRequest.cantidad}`, 420, currentY, { width: 60, align: 'right' });
          
          currentY += 20;
          counter++;
        }

        // --- SECCIÓN 3: FIRMAS ---
        const signaturesY = Math.max(currentY + 65, 600);

        doc.moveTo(80, signaturesY)
           .lineTo(240, signaturesY)
           .moveTo(350, signaturesY)
           .lineTo(510, signaturesY)
           .stroke('#7f8c8d');

        doc.fontSize(9)
           .fillColor('#555555')
           .text(`${firmaEntregadoLabel}`, 80, signaturesY + 8, { width: 160, align: 'center' })
           .text(`${firmaEntregadoNombre}`, 80, signaturesY + 20, { width: 160, align: 'center' })
           
           .text(`${firmaRecibidoLabel}`, 350, signaturesY + 8, { width: 160, align: 'center' })
           .text(`${firmaRecibidoNombre}`, 350, signaturesY + 20, { width: 160, align: 'center' });

        doc.end();

        writeStream.on('finish', () => {
          resolve();
        });

        writeStream.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
