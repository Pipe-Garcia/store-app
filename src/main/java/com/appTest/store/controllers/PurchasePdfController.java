// src/main/java/com/appTest/store/controllers/PurchasePdfController.java
package com.appTest.store.controllers;

import com.appTest.store.services.pdf.PurchasePdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/purchases")
public class PurchasePdfController {

    private final PurchasePdfService pdf;

    @GetMapping("/{id}/pdf")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")   // 👈 SIN "ROLE_"
    public ResponseEntity<byte[]> purchasePdf(@PathVariable Long id){
        byte[] bytes = pdf.renderPurchase(id);
        if (bytes == null) return ResponseEntity.notFound().build();

        String filename = "compra-" + id + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }
}
