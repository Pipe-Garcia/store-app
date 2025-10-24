package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.models.Sale;
import com.appTest.store.models.SaleDetail;
import com.appTest.store.repositories.ISaleRepository;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class InvoicePdfService {

    private final ISaleRepository saleRepo;
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final NumberFormat MONEY = NumberFormat.getCurrencyInstance(LOCALE_AR);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Lee un recurso de classpath como String. */
    private String readClasspathText(String path) {
        try {
            ClassPathResource res = new ClassPathResource(path);
            try (InputStream in = res.getInputStream()) {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            return "";
        }
    }

    /** Devuelve el logo como data URI (base64) para que siempre renderice en PDF. */
    private String loadLogoDataUri() {
        try {
            // Ajustá el path si tu archivo es otro:
            ClassPathResource res = new ClassPathResource("static/img/logo/chimi.png");
            try (InputStream in = res.getInputStream()) {
                byte[] bytes = in.readAllBytes();
                String b64 = Base64.getEncoder().encodeToString(bytes);
                return "data:image/png;base64," + b64;
            }
        } catch (Exception e) {
            return null;
        }
    }

    public byte[] renderSale(Long idSale) {
        Sale sale = saleRepo.findById(idSale).orElse(null);
        if (sale == null) return null;

        // ===== TOTALES =====
        List<SaleDetail> items = sale.getSaleDetailList();
        BigDecimal subtotal = items.stream()
                .map(d -> d.getPriceUni().multiply(d.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal iva = BigDecimal.ZERO; // IVA incluido (ajustable)
        BigDecimal total = subtotal.add(iva);

        // ===== Thymeleaf context =====
        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c", company);
        ctx.setVariable("s", sale);
        ctx.setVariable("items", items);
        ctx.setVariable("subtotal", MONEY.format(subtotal));
        ctx.setVariable("iva", MONEY.format(iva));
        ctx.setVariable("total", MONEY.format(total));
        ctx.setVariable("fecha", sale.getDateSale() != null ? sale.getDateSale().format(DATE) : "-");
        ctx.setVariable("cliente",
                sale.getClient() != null
                        ? ((sale.getClient().getName() == null ? "" : sale.getClient().getName()) + " "
                        + (sale.getClient().getSurname() == null ? "" : sale.getClient().getSurname())).trim()
                        : "Consumidor Final");

        // Inyectamos CSS separado + logo como data URI
        ctx.setVariable("css", readClasspathText("templates/pdf/invoice.css"));
        ctx.setVariable("logoData", loadLogoDataUri());

        String html = templateEngine.process("invoice-sale", ctx);
        html = html.replace("&nbsp;", "&#160;");

        // ===== Render PDF =====
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null); // sin baseUrl; todo embebido
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("No se pudo generar el PDF", e);
        }
    }
}
