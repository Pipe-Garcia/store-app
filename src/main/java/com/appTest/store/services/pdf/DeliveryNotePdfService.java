package com.appTest.store.services.pdf;

import com.appTest.store.config.CompanyProps;
import com.appTest.store.dto.delivery.DeliveryDetailDTO;
import com.appTest.store.services.IDeliveryService;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class DeliveryNotePdfService {

    private final IDeliveryService deliveryService;
    private final TemplateEngine templateEngine;
    private final CompanyProps company;

    private static final Locale LOCALE_AR = new Locale("es", "AR");
    private static final DateTimeFormatter DATE =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // dentro de DeliveryNotePdfService
    private String statusLabel(String statusCode) {
        if (statusCode == null) return "";
        return switch (statusCode.toUpperCase(Locale.ROOT)) {
            case "PENDING"   -> "PENDIENTE";
            case "PARTIAL"   -> "PARCIAL";
            case "COMPLETED" -> "COMPLETADA";
            default          -> statusCode;
        };
    }


    public byte[] renderDeliveryNote(Long idDelivery) {
        // Reutilizamos el detalle ya armado por el servicio
        DeliveryDetailDTO d = deliveryService.getDeliveryDetail(idDelivery);
        if (d == null) {
            return null;
        }

        Context ctx = new Context(LOCALE_AR);
        ctx.setVariable("c", company);
        ctx.setVariable("d", d);
        ctx.setVariable("items", d.getItems());
        ctx.setVariable("fecha",
                d.getDeliveryDate() != null ? d.getDeliveryDate().format(DATE) : "-");
        ctx.setVariable("cliente", d.getClientName());
        ctx.setVariable("statusLabel", statusLabel(d.getStatus()));

        String html = templateEngine.process("delivery-note", ctx);
        html = html.replace("&nbsp;", "&#160;");

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("No se pudo generar el remito de entrega", e);
        }
    }
}
