// com/appTest/store/audit/AuditAspect.java
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
import java.util.List;

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

        // 1) Intentar sacar el ID desde los parámetros
        Long entityId = extractId(sig, pjp.getArgs(), meta.idParam());

        final String action = meta.action();
        final String entity = meta.entity();

        try {
            Object ret = pjp.proceed();

            // 2) Si no lo teníamos, intentar leer el ID del valor devuelto por el método (para CREATE)
            if (entityId == null && ret != null) {
                entityId = tryReadIdFromReturn(ret);
            }

            final Long eid = entityId; // capturar variable efectivamente final

            // Registrar SUCCESS al commit
            onTxCommit(() -> audit.success(action, entity, eid, "OK"));
            return ret;

        } catch (Throwable ex) {
            // Registrar FAIL inmediato (por si hay rollback)
            audit.fail(action, entity, entityId, ex.getMessage());
            throw ex;
        }
    }

    /* ================= helpers ================= */

    private void onTxCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { r.run(); }
            });
        } else {
            r.run();
        }
    }

    private Long extractId(MethodSignature sig, Object[] args, String idParam){
        if (idParam == null || idParam.isBlank()) return null;

        String[] parts = idParam.split("\\.");
        String paramName = parts[0];

        String[] paramNames = sig.getParameterNames();
        if (paramNames == null || paramNames.length == 0) return null;

        for (int i = 0; i < paramNames.length; i++) {
            if (!paramName.equals(paramNames[i])) continue;

            Object value = args[i];
            if (parts.length == 1) return toLong(value);

            Object current = value;
            for (int p = 1; p < parts.length && current != null; p++) {
                current = readPath(current, parts[p]);
            }
            return toLong(current);
        }
        return null;
    }

    /** Intenta leer un ID de un retorno típico de servicio/repositorio tras el save() */
    private Long tryReadIdFromReturn(Object ret){
        // candidatos comunes (agregá más si hace falta)
        List<String> names = List.of(
                "id",
                "idOrder","orderId",
                "idSale","saleId",
                "idDelivery","deliveryId",
                "idStock","stockId",
                "idReservation","idStockReservation","stockReservationId"
        );
        for (String n : names) {
            Object v = readPath(ret, n);
            Long l = toLong(v);
            if (l != null) return l;
        }
        return null;
    }

    /** Lee una propiedad por nombre probando getter y luego campo */
    private Object readPath(Object target, String prop){
        if (target == null || prop == null) return null;
        Class<?> c = target.getClass();
        String cap = prop.substring(0,1).toUpperCase() + prop.substring(1);

        try { // getXxx()
            Method m = c.getMethod("get" + cap);
            return m.invoke(target);
        } catch (Exception ignored) {}

        try { // isXxx()
            Method m = c.getMethod("is" + cap);
            return m.invoke(target);
        } catch (Exception ignored) {}

        try { // campo
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
