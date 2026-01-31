// src/main/java/com/appTest/store/services/pdf/WarehouseStockPdfService.java
package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.models.Stock;
import com.appTest.store.models.Warehouse;
import com.appTest.store.repositories.IStockRepository;
import com.appTest.store.repositories.IWarehouseRepository;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class WarehouseStockPdfService {

    private final IWarehouseRepository warehouseRepo;
    private final IStockRepository stockRepo;
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final DateTimeFormatter DATE =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // ahora la fila trae la cantidad como texto ya formateado
    public record Row(String material, String qtyLabel, String lastUpdate) {}

    public byte[] renderStock(Long warehouseId) {

        Warehouse w = warehouseRepo.findById(warehouseId).orElse(null);
        if (w == null) {
            return null;
        }

        List<Stock> stocks = stockRepo.findByWarehouse_IdWarehouse(warehouseId);
        if (stocks == null || stocks.isEmpty()) {
            return null;
        }

        List<Row> rows = new ArrayList<>();
        BigDecimal totalQty = BigDecimal.ZERO;

        for (Stock s : stocks) {
            String materialName = (s.getMaterial() != null && s.getMaterial().getName() != null)
                    ? s.getMaterial().getName()
                    : "Material #" + (s.getMaterial() != null ? s.getMaterial().getIdMaterial() : "?");

            BigDecimal qty = s.getQuantityAvailable() != null ? s.getQuantityAvailable() : BigDecimal.ZERO;
            totalQty = totalQty.add(qty);

            String qtyLabel = formatQty(qty);

            String lastUpdate = (s.getLastUpdate() != null)
                    ? s.getLastUpdate().format(DATE)
                    : "-";

            rows.add(new Row(materialName, qtyLabel, lastUpdate));
        }

        String totalQtyLabel = formatQty(totalQty);
        String generatedAt   = LocalDateTime.now().format(DATE_TIME);

        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c",             company);
        ctx.setVariable("w",             w);
        ctx.setVariable("rows",          rows);
        ctx.setVariable("totalQtyLabel", totalQtyLabel);
        ctx.setVariable("generatedAt",   generatedAt);

        String html = templateEngine.process("pdf/warehouse-stock", ctx);

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("No se pudo generar el PDF de stock del depósito", e);
        }
    }

    /**
     * Si la cantidad es entera (13.00) => "13"
     * Si tiene decimales (13.5)       => "13,5"
     */
    private String formatQty(BigDecimal qty) {
        if (qty == null) return "0";
        BigDecimal normalized = qty.stripTrailingZeros();
        if (normalized.scale() <= 0) {
            // entero puro
            return normalized.toPlainString();
        }
        // tiene decimales: dejamos hasta los necesarios y usamos coma como separador
        return normalized.toPlainString().replace('.', ',');
    }
}
