package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.models.Purchase;
import com.appTest.store.models.PurchaseDetail;
import com.appTest.store.models.Supplier;
import com.appTest.store.models.enums.DocumentStatus;
import com.appTest.store.repositories.IPurchaseRepository;
import com.appTest.store.repositories.ISupplierRepository;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PurchasesReportPdfService {

    private final IPurchaseRepository purchaseRepo;
    private final ISupplierRepository supplierRepo;
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final DateTimeFormatter DATE =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    public record Row(Long id, LocalDate date, String supplier, BigDecimal total, String status) {}

    public enum Scope {
        FILTERED,
        LAST_7_DAYS,
        CURRENT_MONTH;

        public static Scope from(String raw){
            if (raw == null) return FILTERED;
            try {
                return Scope.valueOf(raw.toUpperCase());
            } catch (IllegalArgumentException e){
                return FILTERED;
            }
        }
    }

    public byte[] renderReport(String scopeRaw,
                               LocalDate from,
                               LocalDate to,
                               Long supplierId,
                               DocumentStatus status) {

        Scope scope = Scope.from(scopeRaw);
        LocalDate today = LocalDate.now();

        switch (scope){
            case LAST_7_DAYS -> {
                to = today;
                from = today.minusDays(6);
            }
            case CURRENT_MONTH -> {
                YearMonth ym = YearMonth.from(today);
                from = ym.atDay(1);
                to   = ym.atEndOfMonth();
            }
            case FILTERED -> {
                // respetar from/to recibidos
            }
        }

        List<Purchase> purchases = purchaseRepo.searchForReport(
                supplierId, from, to, status
        );

        if (purchases == null || purchases.isEmpty()){
            return null;
        }

        List<Row> rows = new ArrayList<>();
        BigDecimal grandTotal = BigDecimal.ZERO;

        for (Purchase p : purchases){
            BigDecimal total = calculateTotal(p);
            grandTotal = grandTotal.add(total);

            String st = (p.getStatus() != null) ? p.getStatus().name() : "ACTIVE";

            rows.add(new Row(
                    p.getIdPurchase(),
                    p.getDatePurchase(),
                    formatSupplier(p.getSupplier()),
                    total,
                    st
            ));
        }

        String title = switch (scope){
            case LAST_7_DAYS   -> "Compras – últimos 7 días";
            case CURRENT_MONTH -> "Compras – mes actual";
            case FILTERED      -> "Compras filtradas";
        };

        String periodLabel;
        if (from == null && to == null){
            periodLabel = "Período: todos";
        } else {
            String fromStr = (from != null) ? from.format(DATE) : "—";
            String toStr   = (to   != null) ? to.format(DATE)   : "—";
            periodLabel = "Período: " + fromStr + " al " + toStr;
        }

        String supplierLabel = "Proveedor: todos";
        if (supplierId != null){
            String name = supplierRepo.findById(supplierId)
                    .map(this::formatSupplier)
                    .orElse("#" + supplierId);
            supplierLabel = "Proveedor: " + name;
        }

        String statusLabel = "Estado: todos";
        if (status != null){
            statusLabel = "Estado: " + (status == DocumentStatus.CANCELLED ? "Anulada" : "Activa");
        }

        String subtitle    = periodLabel + " · " + supplierLabel + " · " + statusLabel;
        String generatedAt = LocalDateTime.now().format(DATE_TIME);

        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c",          company);
        ctx.setVariable("rows",       rows);
        ctx.setVariable("grandTotal", grandTotal);
        ctx.setVariable("title",      title);
        ctx.setVariable("subtitle",   subtitle);
        ctx.setVariable("generatedAt",generatedAt);

        String html = templateEngine.process("pdf/purchases-report", ctx);

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()){
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e){
            throw new RuntimeException("No se pudo generar el PDF de compras", e);
        }
    }

    private BigDecimal calculateTotal(Purchase p){
        if (p.getPurchaseDetails() == null) return BigDecimal.ZERO;
        return p.getPurchaseDetails().stream()
                .map(this::lineAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal lineAmount(PurchaseDetail d){
        if (d == null) return BigDecimal.ZERO;
        BigDecimal qty = d.getQuantity() != null ? d.getQuantity() : BigDecimal.ZERO;

        BigDecimal unit;
        if (d.getPurchasedPrice() != null){
            unit = d.getPurchasedPrice();
        } else if (d.getMaterialSupplier() != null &&
                d.getMaterialSupplier().getPriceUnit() != null){
            unit = d.getMaterialSupplier().getPriceUnit();
        } else {
            unit = BigDecimal.ZERO;
        }
        return unit.multiply(qty);
    }

    private String formatSupplier(Supplier s){
        if (s == null) return "-";
        if (s.getNameCompany() != null && !s.getNameCompany().isBlank()){
            return s.getNameCompany();
        }
        String name = s.getName()    != null ? s.getName()    : "";
        String sur  = s.getSurname() != null ? s.getSurname() : "";
        String full = (name + " " + sur).trim();
        return full.isEmpty() ? "-" : full;
    }
}