package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.dto.sale.SaleDTO;
import com.appTest.store.models.Client;
import com.appTest.store.models.Sale;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.services.ISaleService;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SalesReportPdfService {

    private final ISaleService saleService;
    private final IClientRepository clientRepo;
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final DateTimeFormatter DATE =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    /**
     * Genera el PDF de listado de ventas según el "scope":
     *
     *  - FILTERED / null → usa los mismos filtros que /sales/search
     *  - LAST_7_DAYS     → últimos 7 días (hoy inclusive)
     *  - CURRENT_MONTH   → mes calendario actual
     */
    @Transactional(readOnly = true)
    public byte[] renderSales(
            String scope,
            LocalDate from,
            LocalDate to,
            Long clientId,
            String paymentStatus
    ) {
        String sc = (scope == null ? "FILTERED" : scope.trim().toUpperCase(Locale.ROOT));

        LocalDate today   = LocalDate.now();
        LocalDate effFrom = from;
        LocalDate effTo   = to;
        Long     effClientId    = clientId;
        String   title;

        switch (sc) {
            case "LAST_7_DAYS", "LAST7", "WEEK" -> {
                effTo   = today;
                effFrom = today.minusDays(6);
                effClientId = null; // reporte global
                title = "Ventas últimos 7 días";
            }
            case "CURRENT_MONTH", "MONTH", "THIS_MONTH" -> {
                effFrom = today.withDayOfMonth(1);
                effTo   = today.withDayOfMonth(today.lengthOfMonth());
                effClientId = null;
                title = "Ventas mes actual";
            }
            default -> {
                // FILTERED (o cualquier otro) → respetamos parámetros tal cual
                title = "Ventas filtradas";
            }
        }

        // Usamos la misma lógica de búsqueda que el endpoint /sales/search
        List<Sale> sales = saleService.search(effFrom, effTo, effClientId, paymentStatus);

        if (sales == null || sales.isEmpty()) {
            return null; // el controller lo traduce a 204 No Content
        }

        // Reutilizamos tu mapper completo
        List<SaleDTO> dtos = sales.stream()
                .map(saleService::convertSaleToDto)
                .collect(Collectors.toList());

        // Mapeamos a filas simples para el template
        List<SaleRow> rows = dtos.stream()
                .map(this::toRow)
                .collect(Collectors.toList());

        BigDecimal grandTotal = rows.stream()
                .map(SaleRow::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        String subtitle = buildSubtitle(sc, effFrom, effTo, effClientId, paymentStatus);

        // ===== Contexto Thymeleaf =====
        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c",          company);
        ctx.setVariable("title",      title);
        ctx.setVariable("subtitle",   subtitle);
        ctx.setVariable("generatedAt", LocalDateTime.now().format(DATE_TIME));
        ctx.setVariable("rows",       rows);
        ctx.setVariable("grandTotal", grandTotal);

        String html = templateEngine.process("sales-report", ctx);
        html = html.replace("&nbsp;", "&#160;");

        // ===== Render PDF =====
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("No se pudo generar el PDF de ventas", e);
        }
    }

    /* ============ Fila de reporte ============ */

    @Getter
    @AllArgsConstructor
    public static class SaleRow {
        private final Long id;
        private final LocalDate date;
        private final String client;
        private final BigDecimal total;
        private final String paymentStatus;
    }

    private SaleRow toRow(SaleDTO dto) {
        Long id = dto.getIdSale();

        LocalDate date = dto.getDateSale();

        String clientName = (dto.getClientName() != null && !dto.getClientName().isBlank())
                ? dto.getClientName()
                : "—";

        BigDecimal total = dto.getTotal() != null
                ? dto.getTotal()
                : BigDecimal.ZERO;

        String payLabel = mapPaymentStatus(dto.getPaymentStatus());

        return new SaleRow(id, date, clientName, total, payLabel);
    }

    private String mapPaymentStatus(String code) {
        if (code == null) return "";
        String c = code.toUpperCase(Locale.ROOT);
        return switch (c) {
            case "PAID"    -> "Pagada";
            case "PARTIAL" -> "Pago parcial";
            case "PENDING" -> "Pendiente";
            default        -> code;
        };
    }

    /* ============ Subtítulo con rango / filtros ============ */

    private String buildSubtitle(
            String scope,
            LocalDate from,
            LocalDate to,
            Long clientId,
            String paymentStatus
    ) {
        List<String> parts = new ArrayList<>();

        if (from != null || to != null) {
            String f = (from != null) ? from.format(DATE) : "inicio";
            String t = (to   != null) ? to.format(DATE)   : "hoy";
            parts.add("Período: " + f + " – " + t);
        }

        // Cliente
        if (clientId != null) {
            String label = "Cliente ID: " + clientId;
            try {
                Optional<Client> opt = clientRepo.findById(clientId);
                if (opt.isPresent()) {
                    Client c = opt.get();
                    String fullName = ((c.getName() == null ? "" : c.getName()) + " " +
                            (c.getSurname() == null ? "" : c.getSurname())).trim();
                    if (!fullName.isBlank()) {
                        label = "Cliente: " + fullName;
                    }
                }
            } catch (Exception ignored) {}
            parts.add(label);
        } else {
            parts.add("Cliente: todos");
        }

        // Estado de pago (si viene)
        if (paymentStatus != null && !paymentStatus.isBlank()) {
            parts.add("Estado de pago: " + mapPaymentStatus(paymentStatus));
        }

        if (parts.isEmpty()) {
            return "Sin filtros (todas las ventas visibles).";
        }
        return String.join(" · ", parts);
    }
}

