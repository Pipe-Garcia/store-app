package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.models.Purchase;
import com.appTest.store.models.PurchaseDetail;
import com.appTest.store.repositories.IPurchaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

@Service
@RequiredArgsConstructor
public class PurchasePdfService {

    private final IPurchaseRepository purchaseRepo;
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final NumberFormat MONEY = NumberFormat.getCurrencyInstance(LOCALE_AR);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // ViewModel para la tabla (evita expresiones complejas en Thymeleaf)
    public record Row(String desc, BigDecimal qty, BigDecimal unit, BigDecimal amount) {}

    public byte[] renderPurchase(Long idPurchase) {
        Purchase p = purchaseRepo.findFullById(idPurchase).orElse(null);
        if (p == null) return null;

        // Armar filas
        List<Row> rows = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (PurchaseDetail d : p.getPurchaseDetails()) {
            String desc = (d.getMaterialSupplier()!=null && d.getMaterialSupplier().getMaterial()!=null)
                    ? d.getMaterialSupplier().getMaterial().getName()
                    : "Item";

            BigDecimal qty = d.getQuantity()!=null ? d.getQuantity() : BigDecimal.ZERO;
            BigDecimal unit = d.getPurchasedPrice()!=null
                    ? d.getPurchasedPrice()
                    : (d.getMaterialSupplier()!=null ? d.getMaterialSupplier().getPriceUnit() : BigDecimal.ZERO);

            BigDecimal amount = unit.multiply(qty);
            rows.add(new Row(desc, qty, unit, amount));
            subtotal = subtotal.add(amount);
        }

        BigDecimal iva = BigDecimal.ZERO;            // si luego separás IVA, cámbialo acá
        BigDecimal total = subtotal.add(iva);

        String proveedor = "-";
        if (p.getSupplier()!=null) {
            proveedor = (p.getSupplier().getNameCompany()!=null && !p.getSupplier().getNameCompany().isBlank())
                    ? p.getSupplier().getNameCompany()
                    : ((p.getSupplier().getName()==null?"":p.getSupplier().getName()) + " " +
                    (p.getSupplier().getSurname()==null?"":p.getSupplier().getSurname())).trim();
        }

        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c", company);
        ctx.setVariable("p", p);
        ctx.setVariable("rows", rows);
        ctx.setVariable("proveedor", proveedor);
        ctx.setVariable("subtotal", MONEY.format(subtotal));
        ctx.setVariable("iva", MONEY.format(iva));
        ctx.setVariable("total", MONEY.format(total));
        ctx.setVariable("fecha", p.getDatePurchase()!=null ? p.getDatePurchase().format(DATE) : "-");

        String html = templateEngine.process("pdf/invoice-purchase", ctx);

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()){
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e){
            throw new RuntimeException("No se pudo generar el PDF de la compra", e);
        }
    }
}
