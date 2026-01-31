package com.appTest.store.controllers;

import com.appTest.store.services.pdf.MaterialsPdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequiredArgsConstructor
@RequestMapping("/materials")
public class MaterialsPdfController {

    private final MaterialsPdfService pdfService;

    /**
     * Export de materiales.
     *
     * Ejemplos:
     *  - /materials/pdf?scope=LOW_STOCK
     *  - /materials/pdf?scope=LOW_STOCK&threshold=5
     *  - /materials/pdf?scope=FILTERED&q=cemento&familyId=3
     *  - /materials/pdf?scope=ALL
     */
    @GetMapping("/pdf")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<byte[]> exportMaterialsPdf(
            @RequestParam String scope,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long familyId,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Boolean includeDeleted,
            @RequestParam(required = false) Integer threshold
    ) {
        byte[] bytes = pdfService.renderMaterials(
                scope,
                q,
                familyId,
                minPrice,
                maxPrice,
                includeDeleted,
                threshold
        );

        if (bytes == null || bytes.length == 0) {
            // Sin datos para ese scope/filtros
            return ResponseEntity.noContent().build();
        }

        String safeScope = (scope == null ? "filtered" : scope.toLowerCase());
        String filename = "materiales-" + safeScope + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .body(bytes);
    }
}
