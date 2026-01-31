// src/main/java/com/appTest/store/services/pdf/OrdersReportPdfService.java
package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.dto.orders.OrdersDTO;
import com.appTest.store.models.Client;
import com.appTest.store.models.Orders;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.services.IOrdersService;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

import static java.math.BigDecimal.ZERO;

@Service
@RequiredArgsConstructor
public class OrdersReportPdfService {

    private final IOrdersService ordersService;
    private final IClientRepository clientRepo;

    // Igual que en MaterialsPdfService
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public enum Scope {
        FILTERED,
        ONLY_PENDING,       // solo CON pendiente por vender
        ONLY_NO_PENDING     // solo SIN pendiente (todo vendido)
    }

    public enum StatusFilter {
        PENDING,    // con pendiente
        NO_PENDING  // sin pendiente
    }

    @Getter
    @AllArgsConstructor
    public static class OrdersReportRow {
        private final Long id;
        private final LocalDate dateCreate;
        private final String client;
        private final BigDecimal total;
        private final String statusLabel;
    }

    /**
     * Genera el PDF de presupuestos.
     *
     * scope:
     *  - FILTERED
     *  - ONLY_PENDING      (forzar solo con pendiente)
     *  - ONLY_NO_PENDING   (forzar solo sin pendiente)
     *
     * status (opcional, cuando scope=FILTERED):
     *  - PENDING
     *  - NO_PENDING
     */
    public byte[] renderOrders(
            String scope,
            LocalDate from,
            LocalDate to,
            Long clientId,
            String status
    ) {
        Scope sc = parseScope(scope);
        StatusFilter sf = parseStatusFilter(status);

        // Un solo "assignment" → variable efectivamente final (lambda friendly)
        Boolean filterSoldOut = switch (sc) {
            case ONLY_PENDING    -> Boolean.FALSE; // con pendiente
            case ONLY_NO_PENDING -> Boolean.TRUE;  // sin pendiente
            default -> (sf == null ? null : (sf == StatusFilter.NO_PENDING));
        };

        // ===== 1) Cargar pedidos y filtrar por fecha + cliente =====
        List<Orders> all = ordersService.getAllOrders();
        List<Orders> filtered = all.stream()
                .filter(o -> {
                    LocalDate d = o.getDateCreate();
                    if (from != null && d != null && d.isBefore(from)) return false;
                    if (to   != null && d != null && d.isAfter(to))   return false;
                    return true;
                })
                .filter(o -> {
                    if (clientId == null) return true;
                    return o.getClient() != null
                            && clientId.equals(o.getClient().getIdClient());
                })
                .collect(Collectors.toList());

        // ===== 2) Pasar a DTO y filtrar por "pendiente / sin pendiente" =====
        List<OrdersDTO> dtos = filtered.stream()
                .map(ordersService::convertOrdersToDto)
                .collect(Collectors.toList());

        if (filterSoldOut != null) {
            dtos = dtos.stream()
                    .filter(d -> {
                        Boolean s = d.getSoldOut();
                        if (s == null) {
                            // los null los consideramos "con pendiente"
                            return !filterSoldOut;
                        }
                        return s.equals(filterSoldOut);
                    })
                    .collect(Collectors.toList());
        }

        if (dtos.isEmpty()) {
            // El controller lo traduce a 204 No Content
            return null;
        }

        // ===== 3) Ordenar y mapear a filas del reporte =====
        List<OrdersReportRow> rows = dtos.stream()
                .sorted(Comparator
                        .comparing(OrdersDTO::getDateCreate,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(OrdersDTO::getIdOrders))
                .map(this::toRow)
                .collect(Collectors.toList());

        // ===== 4) Total global =====
        BigDecimal grandTotal = rows.stream()
                .map(OrdersReportRow::getTotal)
                .filter(Objects::nonNull)
                .reduce(ZERO, BigDecimal::add);

        // ===== 5) Datos de cabecera =====
        String title = switch (sc) {
            case ONLY_PENDING    -> "Presupuestos con pendiente por vender";
            case ONLY_NO_PENDING -> "Presupuestos sin pendiente (todo vendido)";
            default              -> "Presupuestos filtrados";
        };

        String subtitle = buildSubtitle(from, to, clientId, filterSoldOut);

        // ===== Contexto Thymeleaf =====
        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c", company);
        ctx.setVariable("title", title);
        ctx.setVariable("subtitle", subtitle);
        ctx.setVariable("generatedAt", LocalDateTime.now().format(DATE_TIME));
        ctx.setVariable("rows", rows);
        ctx.setVariable("grandTotal", grandTotal);

        String html = templateEngine.process("orders-report", ctx);
        // Igual que en materiales, por si quedaron &nbsp;
        html = html.replace("&nbsp;", "&#160;");

        // ===== Render PDF con OpenHTMLtoPDF =====
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("No se pudo generar el PDF de presupuestos", e);
        }
    }

    /* ================== Helpers ================== */

    private Scope parseScope(String s) {
        if (s == null) return Scope.FILTERED;
        try {
            return Scope.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return Scope.FILTERED;
        }
    }

    private StatusFilter parseStatusFilter(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return StatusFilter.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private OrdersReportRow toRow(OrdersDTO dto) {
        String status = statusLabel(dto.getSoldOut());
        return new OrdersReportRow(
                dto.getIdOrders(),
                dto.getDateCreate(),
                dto.getClientName(),
                dto.getTotal(),
                status
        );
    }

    private String statusLabel(Boolean soldOut) {
        if (Boolean.TRUE.equals(soldOut)) {
            return "SIN PENDIENTE";
        }
        return "CON PENDIENTE";
    }

    private String buildSubtitle(LocalDate from,
                                 LocalDate to,
                                 Long clientId,
                                 Boolean filterSoldOut) {

        // Período
        String periodo;
        if (from == null && to == null) {
            periodo = "Período: todos";
        } else {
            String d1 = (from == null) ? "…" : from.format(DATE_FMT);
            String d2 = (to   == null) ? "…" : to.format(DATE_FMT);
            periodo = "Período: " + d1 + " – " + d2;
        }

        // Cliente
        String clienteLabel;
        if (clientId != null) {
            Optional<Client> opt = clientRepo.findById(clientId);
            if (opt.isPresent()) {
                Client cl = opt.get();
                String n  = Optional.ofNullable(cl.getName()).orElse("");
                String ln = Optional.ofNullable(cl.getSurname()).orElse("");
                String full = (n + " " + ln).trim();
                clienteLabel = "Cliente: " + (full.isEmpty() ? ("#" + clientId) : full);
            } else {
                clienteLabel = "Cliente: #" + clientId;
            }
        } else {
            clienteLabel = "Cliente: todos";
        }

        // Estado
        String estado;
        if (filterSoldOut == null) {
            estado = "Estado: todos";
        } else if (Boolean.TRUE.equals(filterSoldOut)) {
            estado = "Estado: sin pendiente (todo vendido)";
        } else {
            estado = "Estado: con pendiente por vender";
        }

        return periodo + " · " + clienteLabel + " · " + estado;
    }
}
