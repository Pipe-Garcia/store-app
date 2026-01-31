package com.appTest.store.controllers;

import com.appTest.store.services.pdf.SalesReportPdfService;
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
@RequestMapping("/sales")
public class SalesReportPdfController {

    private final SalesReportPdfService pdfService;

    @GetMapping("/report-pdf")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")   
    public ResponseEntity<byte[]> exportSalesPdf(
            @RequestParam String scope,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) String paymentStatus
    ) {
        byte[] bytes = pdfService.renderSales(
                scope,
                from,
                to,
                clientId,
                paymentStatus
        );

        if (bytes == null || bytes.length == 0) {
            return ResponseEntity.noContent().build();
        }

        String safeScope = (scope == null ? "filtered" : scope.toLowerCase());
        String filename = "ventas-" + safeScope + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .body(bytes);
    }
}
