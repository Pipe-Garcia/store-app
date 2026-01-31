// src/main/java/com/appTest/store/controllers/WarehouseStockPdfController.java
package com.appTest.store.controllers;

import com.appTest.store.services.pdf.WarehouseStockPdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/warehouses")
public class WarehouseStockPdfController {

    private final WarehouseStockPdfService pdf;

    @GetMapping("/{id}/stock-pdf")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<byte[]> warehouseStockPdf(@PathVariable Long id) {
        byte[] bytes = pdf.renderStock(id);
        if (bytes == null || bytes.length == 0) {
            return ResponseEntity.noContent().build();
        }

        String filename = "stock-deposito-" + id + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .body(bytes);
    }
}
