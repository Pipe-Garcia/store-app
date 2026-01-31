package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.models.Material;
import com.appTest.store.models.Stock;
import com.appTest.store.repositories.IMaterialRepository;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MaterialsPdfService {

    private final IMaterialRepository materialRepo;
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    /**
     * Genera el PDF de materiales en función del "scope":
     *  - LOW_STOCK   → solo materiales con stock total <= threshold
     *  - FILTERED    → mismos filtros que /materials/search
     *  - ALL / ALL_ACTIVE / ALL_MATERIALS → catálogo completo (sin filtros)
     */
    public byte[] renderMaterials(
            String scope,
            String q,
            Long familyId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Boolean includeDeleted,
            Integer threshold
    ) {
        String sc = (scope == null ? "FILTERED" : scope.trim().toUpperCase(Locale.ROOT));
        boolean incDeleted = includeDeleted != null && includeDeleted;
        int lowStockLimit = (threshold != null && threshold > 0) ? threshold : 10;

        List<Material> materials;
        String title;
        String subtitle;

        switch (sc) {
            case "LOW_STOCK", "LOW", "LOWSTOCK" -> {
                materials = findLowStock(lowStockLimit);
                title = "Materiales con stock bajo";
                subtitle = "Stock \u2264 " + lowStockLimit + " unidades";
            }
            case "ALL", "ALL_ACTIVE", "ALL_MATERIALS" -> {
                // Catálogo completo = search() sin filtros
                materials = materialRepo.search(
                        null,
                        null,
                        null,
                        null,
                        incDeleted
                );
                title = "Catálogo de materiales";
                subtitle = incDeleted
                        ? "Incluye materiales deshabilitados"
                        : "Solo materiales vigentes";
            }
            // FILTERED y cualquier otro scope caen acá
            default -> {
                materials = materialRepo.search(
                        (q != null && !q.isBlank()) ? q : null,
                        familyId,
                        minPrice,
                        maxPrice,
                        incDeleted
                );
                title = "Materiales filtrados";
                subtitle = buildFiltersSummary(
                        q,
                        familyId,
                        minPrice,
                        maxPrice,
                        incDeleted
                );
            }
        }

        if (materials == null || materials.isEmpty()) {
            return null; // el controller lo traduce a 204 No Content
        }

        // Normalizamos a una fila "de reporte" desacoplada del entity
        List<MaterialRow> rows = materials.stream()
                .map(this::toRow)
                .collect(Collectors.toList());

        // ===== Contexto Thymeleaf =====
        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c", company);
        ctx.setVariable("title", title);
        ctx.setVariable("subtitle", subtitle);
        ctx.setVariable("generatedAt", LocalDateTime.now().format(DATE_TIME));
        ctx.setVariable("materials", rows);

        String html = templateEngine.process("materials-report", ctx);
        html = html.replace("&nbsp;", "&#160;");

        // ===== Render PDF =====
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null); // todo embebido
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("No se pudo generar el PDF de materiales", e);
        }
    }

    // ================== Helpers de dominio ==================

    /**
     * Busca materiales activos y filtra por stock total <= limit.
     * El stock total se calcula sumando quantityAvailable de la lista de Stock.
     */
    private List<Material> findLowStock(int limit) {
        // includeDeleted = false → solo ACTIVE (según tu query de search)
        List<Material> all = materialRepo.search(null, null, null, null, false);
        if (all == null) return List.of();

        BigDecimal lim = BigDecimal.valueOf(limit);

        return all.stream()
                .filter(m -> {
                    BigDecimal total = sumStock(m);
                    return total.compareTo(lim) <= 0;
                })
                .collect(Collectors.toList());
    }

    private BigDecimal sumStock(Material m) {
        if (m.getStockList() == null || m.getStockList().isEmpty()) {
            return BigDecimal.ZERO;
        }
        return m.getStockList().stream()
                .map(st -> Optional.ofNullable(st.getQuantityAvailable()).orElse(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Texto simpático con un resumen de filtros usados.
     * (Si querés algo más detallado por familia, se puede mejorar después).
     */
    private String buildFiltersSummary(
            String q,
            Long familyId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            boolean includeDeleted
    ) {
        List<String> parts = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            parts.add("Texto: \"" + q + "\"");
        }
        if (familyId != null) {
            parts.add("Familia ID: " + familyId);
        }
        if (minPrice != null) {
            parts.add("Precio \u2265 " + minPrice);
        }
        if (maxPrice != null) {
            parts.add("Precio \u2264 " + maxPrice);
        }
        parts.add(includeDeleted ? "Incluye deshabilitados" : "Solo vigentes");

        if (parts.isEmpty()) {
            return "Sin filtros (todos los materiales visibles).";
        }
        return "Filtros: " + String.join(" · ", parts);
    }

    // ================== Mapeo Material → fila de reporte ==================

    @Getter
    @AllArgsConstructor
    public static class MaterialRow {
        private final String code;
        private final String name;
        private final String family;
        private final Integer stock;
        private final String status;
    }

    /**
     * Mapea el entity Material a una fila amigable para el template.
     * Usa los nombres reales de tu modelo:
     *  - Código  → internalNumber
     *  - Familia → family.typeFamily
     *  - Stock   → suma de quantityAvailable
     *  - Estado  → mapeado a ACTIVO / INACTIVO
     */
    private MaterialRow toRow(Material m) {
        String code = Optional.ofNullable(m.getInternalNumber()).orElse("-");
        String name = Optional.ofNullable(m.getName()).orElse("-");

        String familyName = "";
        if (m.getFamily() != null) {
            // según tu servicio, el nombre legible está en typeFamily
            familyName = Optional.ofNullable(m.getFamily().getTypeFamily()).orElse("");
        }

        BigDecimal total = sumStock(m);
        Integer stock = (total != null) ? total.intValue() : null;

        String statusLabel = mapStatus(m.getStatus());

        return new MaterialRow(code, name, familyName, stock, statusLabel);
    }

    private String mapStatus(String status) {
        if (status == null) return "";
        return switch (status.toUpperCase(Locale.ROOT)) {
            case "ACTIVE" -> "ACTIVO";
            case "INACTIVE" -> "INACTIVO";
            default -> status;
        };
    }
}
