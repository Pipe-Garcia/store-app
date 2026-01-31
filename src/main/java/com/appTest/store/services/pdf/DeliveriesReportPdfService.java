package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.dto.delivery.DeliveryDTO;
import com.appTest.store.models.Client;
import com.appTest.store.models.Delivery;
import com.appTest.store.models.enums.DeliveryStatus;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.services.IDeliveryService;
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
public class DeliveriesReportPdfService {

    private final IDeliveryService deliveryService;
    private final IClientRepository clientRepo;

    // Igual que en Materials / Orders
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /**
     * Scope del reporte:
     *
     *  - FILTERED       → respeta el status que venga por query (si viene)
     *  - ONLY_PENDING   → solo entregas con pendiente (PENDING / PARTIAL)
     *  - ONLY_COMPLETED → solo entregas COMPLETED
     */
    public enum Scope {
        FILTERED,
        ONLY_PENDING,
        ONLY_COMPLETED
    }

    @Getter
    @AllArgsConstructor
    public static class DeliveryReportRow {
        private final Long id;
        private final LocalDate deliveryDate;
        private final String client;
        private final Long saleId;
        private final Long ordersId;
        private final String statusLabel;
        private final BigDecimal deliveredUnits; // unidades entregadas en ESTA entrega
        private final String itemsSummary;       // resumen de materiales
        private final BigDecimal total;          // importe $ de la entrega
    }


    /**
     * Genera el PDF de entregas.
     *
     * scope:
     *  - FILTERED
     *  - ONLY_PENDING      (forzar solo PENDING / PARTIAL)
     *  - ONLY_COMPLETED    (forzar solo COMPLETED)
     *
     * status (opcional, cuando scope=FILTERED):
     *  - PENDING / PARTIAL / COMPLETED
     */
    public byte[] renderDeliveries(
            String scope,
            LocalDate from,
            LocalDate to,
            Long clientId,
            Long saleId,
            String status
    ) {
        Scope sc = parseScope(scope);
        DeliveryStatus st = parseStatus(status);

        // ===== 1) Buscar entregas base según filtros "duros" =====
        // Solo usamos status directo cuando el scope es FILTERED.
        DeliveryStatus repoStatus = (sc == Scope.FILTERED ? st : null);

        List<Delivery> base = deliveryService.search(
                repoStatus,
                saleId,
                clientId,
                from,
                to
        );

        // ===== 2) Filtrar por scope (pendiente / completadas) =====
        List<Delivery> filtered = base.stream()
                .filter(d -> matchesScope(sc, d.getStatus()))
                .collect(Collectors.toList());

        if (filtered.isEmpty()) {
            // El controller lo traduce a 204 No Content
            return null;
        }

        // ===== 3) Ordenar y mapear a filas del reporte =====
        List<DeliveryReportRow> rows = filtered.stream()
                .sorted(Comparator
                        .comparing(Delivery::getDeliveryDate,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Delivery::getIdDelivery))
                .map(this::toRow)
                .collect(Collectors.toList());

        // ===== 4) Totales =====
        BigDecimal totalUnits = rows.stream()
                .map(DeliveryReportRow::getDeliveredUnits)
                .filter(Objects::nonNull)
                .reduce(ZERO, BigDecimal::add);

        BigDecimal grandTotal = rows.stream()
                .map(DeliveryReportRow::getTotal)
                .filter(Objects::nonNull)
                .reduce(ZERO, BigDecimal::add);

        // ===== 5) Datos de cabecera =====
        String title = switch (sc) {
            case ONLY_PENDING   -> "Entregas parciales";
            case ONLY_COMPLETED -> "Entregas completadas";
            default             -> "Entregas filtradas";
        };

        String subtitle = buildSubtitle(from, to, clientId, saleId, sc, st);

        // ===== 6) Contexto Thymeleaf =====
        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c", company);
        ctx.setVariable("title", title);
        ctx.setVariable("subtitle", subtitle);
        ctx.setVariable("generatedAt", LocalDateTime.now().format(DATE_TIME));
        ctx.setVariable("rows", rows);
        ctx.setVariable("totalUnits", totalUnits); // opcional, no lo usa el template hoy
        ctx.setVariable("grandTotal", grandTotal); // <-- lo que usa deliveries-report.html


        // El nombre del template debe coincidir con el .html que vamos a crear luego
        String html = templateEngine.process("deliveries-report", ctx);
        html = html.replace("&nbsp;", "&#160;");

        // ===== 7) Render PDF con OpenHTMLtoPDF =====
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("No se pudo generar el PDF de entregas", e);
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

    private DeliveryStatus parseStatus(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return DeliveryStatus.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    /**
     * Aplica el "scope" sobre el estado de la entrega:
     *  - ONLY_PENDING   → PENDING o PARTIAL (cualquier cosa no COMPLETED)
     *  - ONLY_COMPLETED → solo COMPLETED
     *  - FILTERED       → no hace nada extra
     */
    private boolean matchesScope(Scope sc, DeliveryStatus status) {
        if (status == null) {
            return sc != Scope.ONLY_COMPLETED;
        }
        return switch (sc) {
            case ONLY_PENDING   -> status != DeliveryStatus.COMPLETED;
            case ONLY_COMPLETED -> status == DeliveryStatus.COMPLETED;
            case FILTERED       -> true;
        };
    }

    private DeliveryReportRow toRow(Delivery d) {
        // Reutilizamos toda la lógica linda del service para nombres, unidades, summary, etc.
        DeliveryDTO dto = deliveryService.convertDeliveryToDto(d);

        // Total monetario de la entrega = suma (cantidad entregada * precio snapshot)
        BigDecimal total = BigDecimal.ZERO;
        if (d.getItems() != null) {
            for (var it : d.getItems()) {
                BigDecimal q = it.getQuantityDelivered() != null ? it.getQuantityDelivered() : BigDecimal.ZERO;
                BigDecimal p = it.getUnitPriceSnapshot() != null ? it.getUnitPriceSnapshot() : BigDecimal.ZERO;
                total = total.add(p.multiply(q));
            }
        }

        String statusLabel = statusLabel(dto.getStatus());

        return new DeliveryReportRow(
                dto.getIdDelivery(),
                dto.getDeliveryDate(),
                dto.getClientName(),
                dto.getSaleId(),
                dto.getOrdersId(),
                statusLabel,
                dto.getDeliveredUnits(),
                dto.getItemsSummary(),
                total
        );
    }


    private String statusLabel(String statusCode) {
        if (statusCode == null) return "";
        return switch (statusCode.toUpperCase(Locale.ROOT)) {
            case "PENDING"   -> "PENDIENTE";
            case "PARTIAL"   -> "PARCIAL";
            case "COMPLETED" -> "COMPLETADA";
            default          -> statusCode;
        };
    }

    private String buildSubtitle(
            LocalDate from,
            LocalDate to,
            Long clientId,
            Long saleId,
            Scope scope,
            DeliveryStatus statusFilter
    ) {
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

        // Venta
        String ventaLabel;
        if (saleId != null) {
            ventaLabel = "Venta: #" + saleId;
        } else {
            ventaLabel = "Venta: todas";
        }

        // Estado
        String estadoLabel;
        if (scope == Scope.ONLY_PENDING) {
            // “Pendiente” para nosotros = cualquier entrega NO COMPLETED → parciales
            estadoLabel = "Estado: parciales";
        } else if (scope == Scope.ONLY_COMPLETED) {
            estadoLabel = "Estado: completadas";
        } else if (statusFilter != null) {
            // Si viene filtrado por estado en scope=FILTERED
            if (statusFilter == DeliveryStatus.PARTIAL) {
                estadoLabel = "Estado: parciales";
            } else if (statusFilter == DeliveryStatus.COMPLETED) {
                estadoLabel = "Estado: completadas";
            } else {
                // Por si en el futuro reaparece PENDING u otro
                estadoLabel = "Estado: " + statusLabel(statusFilter.name());
            }
        } else {
            estadoLabel = "Estado: todos";
        }

        return periodo + " · " + clienteLabel + " · " + ventaLabel + " · " + estadoLabel;
    }

}

