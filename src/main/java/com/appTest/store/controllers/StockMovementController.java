package com.appTest.store.controllers;

import com.appTest.store.dto.audit.StockMovementDTO;
import com.appTest.store.models.audit.StockMovement;
import com.appTest.store.repositories.audit.StockMovementRepository;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/stock-movements")
public class StockMovementController {

    private final StockMovementRepository repo;
    public StockMovementController(StockMovementRepository repo){ this.repo=repo; }

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_OWNER','ROLE_EMPLOYEE')")
    public Page<StockMovementDTO> list(
            @RequestParam(required=false) @DateTimeFormat(iso= DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso= DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required=false) Long materialId,
            @RequestParam(required=false) Long warehouseId,
            @RequestParam(required=false) String reason,
            @RequestParam(required=false) String user,
            @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="50") int size
    ){
        Specification<StockMovement> spec = (root, q, cb)->{
            List<Predicate> ps = new ArrayList<>();
            if (from!=null) ps.add(cb.greaterThanOrEqualTo(root.get("timestamp"), from.atStartOfDay()));
            if (to!=null)   ps.add(cb.lessThan(root.get("timestamp"), to.plusDays(1).atStartOfDay()));
            if (materialId!=null) ps.add(cb.equal(root.get("materialId"), materialId));
            if (warehouseId!=null) ps.add(cb.equal(root.get("warehouseId"), warehouseId));
            if (reason!=null && !reason.isBlank()) ps.add(cb.equal(root.get("reason"), reason));
            if (user!=null && !user.isBlank()) ps.add(cb.like(cb.lower(root.get("userName")), "%"+user.toLowerCase()+"%"));
            return cb.and(ps.toArray(Predicate[]::new));
        };
        Pageable pg = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        return repo.findAll(spec, pg).map(m ->
                new StockMovementDTO(m.getId(), m.getTimestamp(),
                        m.getMaterialId(), m.getMaterialName(),
                        m.getWarehouseId(), m.getWarehouseName(),
                        m.getFromQty(), m.getToQty(), m.getDelta(),
                        m.getReason(), m.getSourceType(), m.getSourceId(),
                        m.getUserName(), m.getNote())
        );
    }
}

