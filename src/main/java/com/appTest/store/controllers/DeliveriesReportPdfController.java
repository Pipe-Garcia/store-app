package com.appTest.store.controllers;

import com.appTest.store.services.pdf.DeliveryNotePdfService;
import com.appTest.store.services.pdf.DeliveriesReportPdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequiredArgsConstructor
@RequestMapping("/deliveries")
public class DeliveriesReportPdfController {

    private final DeliveriesReportPdfService pdfService;
    private final DeliveryNotePdfService notePdfService;

    /**
     * Export de listado de entregas.
     *
     * Ejemplos:
     *  - /deliveries/report-pdf?scope=FILTERED&from=2026-01-01&to=2026-01-31&clientId=5&status=PENDING
     *  - /deliveries/report-pdf?scope=ONLY_PENDING
     *  - /deliveries/report-pdf?scope=ONLY_COMPLETED
     */
    @GetMapping("/report-pdf")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<byte[]> exportDeliveriesPdf(
            @RequestParam String scope,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) Long saleId,
            @RequestParam(required = false) String status
    ) {
        byte[] bytes = pdfService.renderDeliveries(scope, from, to, clientId, saleId, status);

        if (bytes == null || bytes.length == 0) {
            return ResponseEntity.noContent().build();
        }

        String safeScope = (scope == null ? "filtered" : scope.toLowerCase());
        String filename = "entregas-" + safeScope + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .body(bytes);
    }

    /**
     * Remito de una entrega puntual.
     * GET /deliveries/{id}/note-pdf
     */
    @GetMapping("/{id}/note-pdf")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<byte[]> exportDeliveryNote(@PathVariable Long id) {
        byte[] bytes = notePdfService.renderDeliveryNote(id);

        if (bytes == null || bytes.length == 0) {
            return ResponseEntity.notFound().build();
        }

        String filename = "entrega-" + id + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .body(bytes);
    }

}
