package com.appTest.store.controllers;

import com.appTest.store.services.pdf.OrdersReportPdfService;
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
@RequestMapping("/orders")
public class OrdersReportPdfController {

    private final OrdersReportPdfService pdfService;

    /**
     * Export de listado de presupuestos.
     *
     * Ejemplos:
     *  - /orders/report-pdf?scope=FILTERED&from=2026-01-01&to=2026-01-31&clientId=5&status=PENDING
     *  - /orders/report-pdf?scope=ONLY_PENDING
     *  - /orders/report-pdf?scope=ONLY_NO_PENDING
     */
    @GetMapping("/report-pdf")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<byte[]> exportOrdersPdf(
            @RequestParam String scope,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) String status
    ) {
        byte[] bytes = pdfService.renderOrders(scope, from, to, clientId, status);

        if (bytes == null || bytes.length == 0) {
            return ResponseEntity.noContent().build();
        }

        String safeScope = (scope == null ? "filtered" : scope.toLowerCase());
        String filename = "presupuestos-" + safeScope + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .body(bytes);
    }
}
