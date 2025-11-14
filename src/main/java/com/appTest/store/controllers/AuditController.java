package com.appTest.store.controllers;

import com.appTest.store.dto.audit.*;
import com.appTest.store.models.audit.AuditDetail;
import com.appTest.store.models.audit.AuditEvent;
import com.appTest.store.repositories.audit.AuditDetailRepository;
import com.appTest.store.repositories.audit.AuditEventRepository;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/audits")
public class AuditController {

    private final AuditEventRepository evRepo;
    private final AuditDetailRepository detRepo;

    public AuditController(AuditEventRepository evRepo, AuditDetailRepository detRepo){
        this.evRepo = evRepo; this.detRepo = detRepo;
    }


    @GetMapping("/events")
    @PreAuthorize("hasAnyRole('ROLE_OWNER','ROLE_EMPLOYEE')")
    public Page<AuditEventListDTO> list(
            @RequestParam(required=false) @DateTimeFormat(iso= DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso= DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required=false) String actor,
            @RequestParam(required=false) String action,
            @RequestParam(required=false) String actionGroup,   
            @RequestParam(required=false) String entity,
            @RequestParam(required=false) Long entityId,
            @RequestParam(required=false) String status,
            @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size
    ){
        Specification<AuditEvent> spec = (root, q, cb)->{
            List<Predicate> ps = new ArrayList<>();
            if (from!=null) ps.add(cb.greaterThanOrEqualTo(root.get("timestamp"), from.atStartOfDay()));
            if (to!=null)   ps.add(cb.lessThan(root.get("timestamp"), to.plusDays(1).atStartOfDay()));
            if (actor!=null && !actor.isBlank())  ps.add(cb.like(cb.lower(root.get("actorName")), "%"+actor.toLowerCase()+"%"));

            if (actionGroup!=null && !actionGroup.isBlank()){
                // CREATE -> (= 'CREATE' OR LIKE '%_CREATE'), idem para UPDATE/DELETE
                String suffix = "_" + actionGroup;
                ps.add(cb.or(
                        cb.equal(root.get("action"), actionGroup),
                        cb.like(root.get("action"), "%"+suffix)
                ));
            } else if (action!=null && !action.isBlank()){
                ps.add(cb.equal(root.get("action"), action));
            }

            if (entity!=null && !entity.isBlank()) ps.add(cb.equal(root.get("entity"), entity));
            if (entityId!=null)                    ps.add(cb.equal(root.get("entityId"), entityId));
            if (status!=null && !status.isBlank()) ps.add(cb.equal(root.get("status"), status));
            return cb.and(ps.toArray(Predicate[]::new));
        };
        Pageable pg = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        return evRepo.findAll(spec, pg).map(e ->
                new AuditEventListDTO(e.getId(), e.getTimestamp(), e.getActorName(),
                        e.getAction(), e.getEntity(), e.getEntityId(), e.getStatus(), e.getMessage())
        );
    }


    @GetMapping("/events/{id}")
    @PreAuthorize("hasAnyRole('ROLE_OWNER','ROLE_EMPLOYEE')")
    public AuditEventDetailDTO get(@PathVariable Long id){
        var e = evRepo.findById(id).orElseThrow();
        var rows = detRepo.findByEventId(id).stream()
                .map(d -> new AuditEventDetailDTO.DiffRow(d.getDiffJson(), d.getOldJson(), d.getNewJson()))
                .toList();
        return new AuditEventDetailDTO(
                e.getId(), e.getTimestamp(), e.getActorName(), e.getRoles(),
                e.getIp(), e.getUserAgent(), e.getRequestId(),
                e.getAction(), e.getEntity(), e.getEntityId(),
                e.getStatus(), e.getMessage(), rows
        );
    }
}
