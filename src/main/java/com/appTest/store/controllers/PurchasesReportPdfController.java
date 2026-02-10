package com.appTest.store.controllers;

import com.appTest.store.models.enums.DocumentStatus;
import com.appTest.store.services.pdf.PurchasesReportPdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Locale;

@RestController
@RequiredArgsConstructor
@RequestMapping("/purchases")
public class PurchasesReportPdfController {

    private final PurchasesReportPdfService reportPdf;

    @GetMapping("/report-pdf")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<byte[]> purchasesReportPdf(
            @RequestParam(name = "scope", defaultValue = "FILTERED") String scope,
            @RequestParam(name = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "supplierId", required = false) Long supplierId,
            @RequestParam(name = "status", required = false) DocumentStatus status
    ){
        byte[] bytes = reportPdf.renderReport(scope, from, to, supplierId, status);
        if (bytes == null || bytes.length == 0){
            return ResponseEntity.noContent().build();
        }

        String scopeSlug = scope == null ? "filtered" : scope.toLowerCase(Locale.ROOT);
        String filename = "compras-" + scopeSlug + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }
}