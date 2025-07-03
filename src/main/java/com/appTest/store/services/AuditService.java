//package com.appTest.store.services;
//
//import com.appTest.store.models.Audit;
//import com.appTest.store.repositories.AuditRepository;
//import com.fasterxml.jackson.databind.ObjectMapper;
//import org.springframework.security.core.context.SecurityContextHolder;
//import org.springframework.stereotype.Service;
//import org.springframework.transaction.annotation.Transactional;
//
//import java.time.LocalDateTime;
//
//@Service
//public class AuditService {
//
//    private final AuditRepository auditRepository;
//    private final ObjectMapper objectMapper;
//
//    public AuditService(AuditRepository auditRepository, ObjectMapper objectMapper) {
//        this.auditRepository = auditRepository;
//        this.objectMapper = objectMapper;
//    }
//
//    @Transactional
//    public void createAudit(Object entity, String action, String oldValue) {
//        Audit audit = new Audit();
//        audit.setTableName(entity.getClass().getSimpleName());
//        // El ID se obtendrá después de persistir la entidad principal
//        audit.setAction(action);
//        audit.setChangedBy(SecurityContextHolder.getContext().getAuthentication() != null
//                ? SecurityContextHolder.getContext().getAuthentication().getName() : "system");
//        audit.setChangeDate(LocalDateTime.now());
//        audit.setOldValue(oldValue);
//
//        try {
//            String jsonNewValue = objectMapper.writeValueAsString(entity);
//            audit.setNewValue(jsonNewValue);
//        } catch (Exception e) {
//            audit.setNewValue("Serialization failed");
//        }
//
//        auditRepository.save(audit);
//    }
//}
