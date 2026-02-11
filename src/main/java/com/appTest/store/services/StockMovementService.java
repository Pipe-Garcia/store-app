package com.appTest.store.services;

import com.appTest.store.audit.RequestContext;
import com.appTest.store.models.audit.StockMovement;
import com.appTest.store.repositories.audit.StockMovementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class StockMovementService {

    private final StockMovementRepository repo;

    @Transactional
    public void logChange(Long materialId, String materialName,
                          Long warehouseId, String warehouseName,
                          BigDecimal fromQty, BigDecimal toQty,
                          String reason, String sourceType, Long sourceId,
                          String note) {

        var m = new StockMovement();
        m.setTimestamp(LocalDateTime.now());
        m.setMaterialId(materialId);
        m.setMaterialName(materialName);
        m.setWarehouseId(warehouseId);
        m.setWarehouseName(warehouseName);

        m.setFromQty(fromQty);
        m.setToQty(toQty);
        m.setDelta(toQty.subtract(fromQty));

        m.setReason(reason);
        m.setSourceType(sourceType);
        m.setSourceId(sourceId);

        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            m.setUserName(auth.getName());
        }

        var ctx = RequestContext.get();
        if (ctx != null) m.setRequestId(ctx.getRequestId());

        m.setNote(note);
        repo.save(m);
    }

    @Transactional
    public void retagForCurrentRequest(Set<String> onlyIfReasons,
                                       String newReason,
                                       String sourceType,
                                       Long sourceId,
                                       String notePrefix) {

        var ctx = RequestContext.get();
        if (ctx == null) return;

        String requestId = ctx.getRequestId();
        if (requestId == null || requestId.isBlank()) return;

        List<StockMovement> list = repo.findByRequestId(requestId);
        if (list == null || list.isEmpty()) return;

        Set<String> allowed = null;
        if (onlyIfReasons != null && !onlyIfReasons.isEmpty()) {
            allowed = new HashSet<>();
            for (String r : onlyIfReasons) {
                if (r == null) continue;
                allowed.add(r.trim().toUpperCase(Locale.ROOT));
            }
        }

        for (StockMovement m : list) {
            if (m == null) continue;

            String r0 = m.getReason();
            if (r0 == null) continue;

            String r = r0.trim().toUpperCase(Locale.ROOT);
            if (allowed != null && !allowed.contains(r)) continue;

            m.setReason(newReason);

            if (sourceType != null && !sourceType.isBlank()) {
                m.setSourceType(sourceType);
            }
            if (sourceId != null) {
                m.setSourceId(sourceId);
            }

            if (notePrefix != null && !notePrefix.isBlank()) {
                String old = m.getNote();
                if (old == null || old.isBlank()) m.setNote(notePrefix);
                else m.setNote(notePrefix + " · " + old);
            }
        }

        repo.saveAll(list);
    }
}