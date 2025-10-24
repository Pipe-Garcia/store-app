// src/main/java/com/appTest/store/controllers/SalesPdfController.java
package com.appTest.store.controllers;

import com.appTest.store.services.pdf.InvoicePdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/sales")
public class SalesPdfController {

    private final InvoicePdfService pdf;

    @GetMapping("/{id}/pdf")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<byte[]> salePdf(@PathVariable Long id){
        byte[] bytes = pdf.renderSale(id);
        if (bytes == null) return ResponseEntity.notFound().build();

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"factura-"+id+".pdf\"")
                .body(bytes);
    }
}

