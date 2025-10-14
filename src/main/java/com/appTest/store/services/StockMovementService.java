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

@Service
@RequiredArgsConstructor
public class StockMovementService {
    private final StockMovementRepository repo;

    @Transactional
    public void logChange(Long materialId, String materialName,
                          Long warehouseId, String warehouseName,
                          BigDecimal fromQty, BigDecimal toQty,
                          String reason, String sourceType, Long sourceId,
                          String note){
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
        if (auth!=null){
            m.setUserName(auth.getName());
            // userId si lo tenés disponible en tu UserDetails
        }
        var ctx = RequestContext.get();
        if (ctx!=null) m.setRequestId(ctx.getRequestId());
        m.setNote(note);
        repo.save(m);
    }
}

