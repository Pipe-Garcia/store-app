package com.appTest.store.audit;

import com.appTest.store.services.AuditService;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * Aspecto de auditoría:
 * - Lee @Auditable(action, entity, idParam)
 * - Soporta idParam con "ruta" (p.ej. "dto.idStock" o "cmd.order.id")
 * - Registra SUCCESS al commit y FAIL inmediato en excepción
 */
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditService audit;

    @Around("@annotation(com.appTest.store.audit.Auditable)")
    public Object aroundAuditable(ProceedingJoinPoint pjp) throws Throwable {
        MethodSignature sig = (MethodSignature) pjp.getSignature();
        Method method = sig.getMethod();
        Auditable meta = method.getAnnotation(Auditable.class);

        // Resolver entityId si se especificó un parámetro por nombre/ruta
        Long entityId = extractId(sig, pjp.getArgs(), meta.idParam());

        final Long   eid    = entityId;
        final String action = meta.action();
        final String entity = meta.entity();

        try {
            Object ret = pjp.proceed();
            // SUCCESS: al commit (no impacta la transacción del caso de uso)
            onTxCommit(() -> audit.success(action, entity, eid, "OK"));
            return ret;
        } catch (Throwable ex) {
            // FAIL: registrar ya (si hay rollback, afterCommit no corre)
            audit.fail(action, entity, eid, ex.getMessage());
            throw ex;
        }
    }

    /* ===================== helpers ===================== */

    private void onTxCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { r.run(); }
            });
        } else {
            // fuera de TX
            r.run();
        }
    }

    /**
     * Extrae el ID según idParam:
     *  - ""  -> null (no se especificó)
     *  - "id" -> busca parámetro llamado "id"
     *  - "dto.idStock" -> toma el parámetro "dto" y navega "idStock"
     */
    private Long extractId(MethodSignature sig, Object[] args, String idParam){
        if (idParam == null || idParam.isBlank()) return null;

        String[] parts = idParam.split("\\.");
        String paramName = parts[0];

        String[] paramNames = sig.getParameterNames();
        if (paramNames == null || paramNames.length == 0) return null;

        for (int i = 0; i < paramNames.length; i++) {
            if (!paramName.equals(paramNames[i])) continue;

            Object value = args[i];
            // si no hay ruta (solo "id"), convertí directo
            if (parts.length == 1) return toLong(value);

            // hay ruta: navegar propiedades
            Object current = value;
            for (int p = 1; p < parts.length && current != null; p++) {
                current = readPath(current, parts[p]);
            }
            return toLong(current);
        }
        return null;
    }

    /**
     * Lee una propiedad por nombre tratando getters primero y luego campo.
     * Soporta "idStock" => getIdStock() / isIdStock() / campo "idStock".
     */
    private Object readPath(Object target, String prop){
        if (target == null || prop == null) return null;
        Class<?> c = target.getClass();
        String cap = prop.substring(0,1).toUpperCase() + prop.substring(1);

        // getter getXxx()
        try {
            Method m = c.getMethod("get" + cap);
            return m.invoke(target);
        } catch (Exception ignored) {}

        // getter boolean isXxx()
        try {
            Method m = c.getMethod("is" + cap);
            return m.invoke(target);
        } catch (Exception ignored) {}

        // acceso directo a campo
        try {
            Field f = c.getDeclaredField(prop);
            f.setAccessible(true);
            return f.get(target);
        } catch (Exception ignored) {}

        return null;
    }

    private Long toLong(Object v){
        if (v == null) return null;
        if (v instanceof Long l) return l;
        if (v instanceof Integer i) return i.longValue();
        if (v instanceof Short s) return s.longValue();
        if (v instanceof String s) {
            try { return Long.parseLong(s.trim()); } catch (Exception ignored) {}
        }
        return null;
    }
}


