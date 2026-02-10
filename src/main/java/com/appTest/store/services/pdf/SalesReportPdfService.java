// SalesReportPdfService.java
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
import java.lang.reflect.Field;
import java.lang.reflect.Method;
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
     *
     * state (front-only):
     *  - CANCELLED | DELIVERED | PENDING_DELIVERY
     */
    @Transactional(readOnly = true)
    public byte[] renderSales(
            String scope,
            LocalDate from,
            LocalDate to,
            Long clientId,
            String paymentStatus,
            String state
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
                title = "Ventas filtradas";
            }
        }

        // Misma lógica de búsqueda que /sales/search (filtros server: fechas/cliente/pago)
        List<Sale> sales = saleService.search(effFrom, effTo, effClientId, paymentStatus);

        if (sales == null || sales.isEmpty()) {
            return null;
        }

        // Mapper existente
        List<SaleDTO> dtos = sales.stream()
                .map(saleService::convertSaleToDto)
                .collect(Collectors.toList());

        // ✅ Filtro adicional por "state" (front-only)
        String st = (state == null ? "" : state.trim().toUpperCase(Locale.ROOT));
        if (!st.isBlank()) {
            dtos = dtos.stream()
                    .filter(dto -> matchesState(dto, st))
                    .collect(Collectors.toList());
        }

        if (dtos.isEmpty()) {
            return null;
        }

        // Filas simples para el template
        List<SaleRow> rows = dtos.stream()
                .map(this::toRow)
                .collect(Collectors.toList());

        BigDecimal grandTotal = rows.stream()
                .map(SaleRow::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        String subtitle = buildSubtitle(sc, effFrom, effTo, effClientId, paymentStatus, st);

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

    /* ================== Filtro state (CANCELLED/DELIVERED/PENDING_DELIVERY) ================== */

    private boolean matchesState(SaleDTO dto, String state) {
        String saleStatus = getSaleStatusCode(dto); // ACTIVE | CANCELLED (u otro)
        if ("CANCELLED".equals(state)) {
            return "CANCELLED".equals(saleStatus);
        }
        // Pendiente/Entregada: excluir anuladas
        if ("CANCELLED".equals(saleStatus)) {
            return false;
        }
        String deliveryState = getDeliveryStateCode(dto); // DELIVERED | PENDING_DELIVERY
        return state.equals(deliveryState);
    }

    private String getSaleStatusCode(SaleDTO dto) {
        String raw = readString(dto, "status", "saleStatus");
        raw = upper(raw);
        if (raw.isBlank()) raw = "ACTIVE";
        if ("ANULADA".equals(raw)) return "CANCELLED";
        return raw;
    }

    private String getDeliveryStateCode(SaleDTO dto) {
        // VENTA DIRECTA (sin presupuesto asociado) → ENTREGADA
        boolean hasOrder = hasOrder(dto);
        if (!hasOrder) return "DELIVERED";

        String explicit = upper(readString(dto, "deliveryStatus", "deliveryState"));
        if (containsAny(explicit, "DELIVERED", "COMPLETED", "FULL", "ENTREGADA", "DIRECT")) return "DELIVERED";
        if (containsAny(explicit, "PENDING", "PARTIAL", "IN_PROGRESS", "PENDIENTE")) return "PENDING_DELIVERY";

        Boolean fully = readBoolean(dto, "fullyDelivered", "allDelivered", "deliveryCompleted");
        if (fully != null) return fully ? "DELIVERED" : "PENDING_DELIVERY";

        double sold = readNumber(dto,
                "totalUnits", "unitsSold", "totalQuantity", "quantityTotal", "unitsTotal"
        );
        double delivered = readNumber(dto,
                "deliveredUnits", "unitsDelivered", "deliveryUnits", "totalDelivered"
        );
        double pending = readNumber(dto,
                "pendingToDeliver", "pendingUnits", "unitsPending", "toDeliver"
        );

        // Si pending no viene, lo inferimos
        if (Double.isNaN(pending) || pending == 0d) {
            if (sold > 0) pending = Math.max(0d, sold - delivered);
        }

        if (sold > 0) {
            if (pending > 0) return "PENDING_DELIVERY";
            if (delivered >= sold) return "DELIVERED";
            return "PENDING_DELIVERY";
        }

        if (pending > 0) return "PENDING_DELIVERY";
        if (delivered > 0) return "DELIVERED";
        return "PENDING_DELIVERY";
    }

    private boolean hasOrder(SaleDTO dto) {
        Long orderId = readLong(dto, "orderId", "ordersId", "order_id", "idOrders", "idOrder");
        if (orderId != null && orderId > 0) return true;

        // nested: orders.idOrders, order.idOrders, etc
        Long nested1 = readNestedLong(dto, "orders", "idOrders");
        if (nested1 != null && nested1 > 0) return true;

        Long nested2 = readNestedLong(dto, "order", "idOrders");
        if (nested2 != null && nested2 > 0) return true;

        Long nested3 = readNestedLong(dto, "orders", "ordersId");
        if (nested3 != null && nested3 > 0) return true;

        return false;
    }

    /* ================== Reflection helpers (tolerantes) ================== */

    private static String upper(String s) {
        return (s == null ? "" : s.trim().toUpperCase(Locale.ROOT));
    }

    private static boolean containsAny(String base, String... tokens) {
        if (base == null || base.isBlank()) return false;
        for (String t : tokens) {
            if (base.contains(t)) return true;
        }
        return false;
    }

    private Object readProp(Object bean, String name) {
        if (bean == null || name == null || name.isBlank()) return null;
        Class<?> c = bean.getClass();

        String cap = Character.toUpperCase(name.charAt(0)) + name.substring(1);

        // getX()
        try {
            Method m = c.getMethod("get" + cap);
            return m.invoke(bean);
        } catch (Exception ignored) {}

        // isX()
        try {
            Method m = c.getMethod("is" + cap);
            return m.invoke(bean);
        } catch (Exception ignored) {}

        // field access
        try {
            Field f = c.getDeclaredField(name);
            f.setAccessible(true);
            return f.get(bean);
        } catch (Exception ignored) {}

        return null;
    }

    private String readString(Object bean, String... names) {
        for (String n : names) {
            Object v = readProp(bean, n);
            if (v == null) continue;
            String s = String.valueOf(v).trim();
            if (!s.isBlank()) return s;
        }
        return null;
    }

    private Long readLong(Object bean, String... names) {
        for (String n : names) {
            Object v = readProp(bean, n);
            Long out = toLong(v);
            if (out != null) return out;
        }
        return null;
    }

    private Long readNestedLong(Object bean, String nestedObjName, String nestedPropName) {
        Object nested = readProp(bean, nestedObjName);
        if (nested == null) return null;
        Object v = readProp(nested, nestedPropName);
        return toLong(v);
    }

    private Boolean readBoolean(Object bean, String... names) {
        for (String n : names) {
            Object v = readProp(bean, n);
            if (v instanceof Boolean b) return b;
            if (v instanceof String s) {
                String u = s.trim().toUpperCase(Locale.ROOT);
                if ("TRUE".equals(u)) return true;
                if ("FALSE".equals(u)) return false;
            }
            if (v instanceof Number num) {
                return num.intValue() != 0;
            }
        }
        return null;
    }

    private double readNumber(Object bean, String... names) {
        for (String n : names) {
            Object v = readProp(bean, n);
            Double out = toDouble(v);
            if (out != null) return out;
        }
        return 0d;
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Long l) return l;
        if (v instanceof Integer i) return i.longValue();
        if (v instanceof Short s) return s.longValue();
        if (v instanceof BigDecimal bd) return bd.longValue();
        if (v instanceof Number num) return num.longValue();
        if (v instanceof String str) {
            String t = str.trim();
            if (t.isBlank()) return null;
            try { return Long.parseLong(t); } catch (Exception ignored) {}
        }
        return null;
    }

    private Double toDouble(Object v) {
        if (v == null) return null;
        if (v instanceof Double d) return d;
        if (v instanceof Float f) return (double) f;
        if (v instanceof BigDecimal bd) return bd.doubleValue();
        if (v instanceof Number num) return num.doubleValue();
        if (v instanceof String str) {
            String t = str.trim().replace(",", ".");
            if (t.isBlank()) return null;
            try { return Double.parseDouble(t); } catch (Exception ignored) {}
        }
        return null;
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
            String paymentStatus,
            String state
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

        // Estado (entrega/anulada) si viene
        if (state != null && !state.isBlank()) {
            parts.add("Estado: " + mapUiState(state));
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

    private String mapUiState(String code) {
        String c = (code == null ? "" : code.trim().toUpperCase(Locale.ROOT));
        return switch (c) {
            case "CANCELLED", "ANULADA" -> "Anulada";
            case "DELIVERED", "ENTREGADA" -> "Entregada";
            case "PENDING_DELIVERY", "PENDING", "PENDIENTE" -> "Pendiente a entregar";
            default -> code;
        };
    }
}