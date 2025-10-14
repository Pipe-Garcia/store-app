package com.appTest.store.services;

import com.appTest.store.audit.RequestContext;
import com.appTest.store.models.audit.AuditDetail;
import com.appTest.store.models.audit.AuditEvent;
import com.appTest.store.repositories.audit.AuditDetailRepository;
import com.appTest.store.repositories.audit.AuditEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditEventRepository eventRepo;
    private final AuditDetailRepository detailRepo;
    private final ObjectMapper om;

    @Value("${store.audit.enabled:true}")
    private boolean enabled;

    private String actorName() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return (a != null && a.getName() != null) ? a.getName() : "system";
    }
    private Long actorId() {
        // Si más adelante tenés el ID del usuario en el principal, mapear aquí.
        return null;
    }
    private String roles() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null) return null;
        return (a.getAuthorities() == null) ? null : a.getAuthorities().toString();
    }

    /** ÉXITO: se invoca desde afterCommit en el aspecto. Va en una TX NUEVA. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Long success(String action, String entity, Long entityId, String message) {
        if (!enabled) return null;
        return saveEvent("SUCCESS", action, entity, entityId, message);
    }

    /** ERROR: se invoca inmediatamente en el catch del aspecto. Va en una TX NUEVA. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Long fail(String action, String entity, Long entityId, String message) {
        if (!enabled) return null;
        return saveEvent("FAIL", action, entity, entityId, message);
    }

    // No anotar @Transactional aquí (método private no la aplicaría). Las TX las abren success/fail.
    private Long saveEvent(String status, String action, String entity, Long entityId, String message) {
        var ctx = RequestContext.get();

        var ev = new AuditEvent();
        ev.setTimestamp(LocalDateTime.now());
        ev.setActorId(actorId());
        ev.setActorName(actorName());
        ev.setRoles(roles());

        if (ctx != null) {
            ev.setIp(ctx.getIp());
            ev.setUserAgent(ctx.getUserAgent());
            ev.setRequestId(ctx.getRequestId());
        }

        ev.setAction(action);
        ev.setEntity(entity);
        ev.setEntityId(entityId);
        ev.setStatus(status);
        ev.setMessage(message);

        System.out.println("[AUDIT SAVE] " + status + " " + action + " " + entity + " (id=" + entityId + ")");
        return eventRepo.save(ev).getId();
    }

    /** Adjunta diff/old/new al evento (opcional). También en TX nueva. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void attachDiff(Long eventId, Object oldObj, Object newObj, Object diff) {
        if (!enabled) return;
        var ev = eventRepo.findById(eventId).orElseThrow();
        var d = new AuditDetail();
        d.setEvent(ev);
        try {
            if (oldObj != null) d.setOldJson(om.writeValueAsString(oldObj));
            if (newObj != null) d.setNewJson(om.writeValueAsString(newObj));
            if (diff   != null) d.setDiffJson(om.writeValueAsString(diff));
        } catch (Exception ignored) {
            // Auditoría best-effort: no romper el flujo por problemas de serialización.
        }
        detailRepo.save(d);
    }
}
