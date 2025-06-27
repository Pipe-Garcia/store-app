package com.appTest.store.listeners;

import com.appTest.store.models.Audit;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class AuditListener {

    @PersistenceContext
    private EntityManager entityManager; // Inyectado por Spring, no manual

    @PrePersist
    public void prePersist(Object entity) {
        createAudit(entity, "INSERT", null);
    }

    @PreUpdate
    public void preUpdate(Object entity) {
        createAudit(entity, "UPDATE", null); // oldValue pendiente
    }

    @PreRemove
    public void preRemove(Object entity) {
        createAudit(entity, "DELETE", null);
    }

    private void createAudit(Object entity, String action, String oldValue) {
        EntityManager em = entityManager; // Usar el inyectado
        EntityTransaction tx = em.getTransaction();

        try {
            tx.begin();

            Audit audit = new Audit();
            audit.setTableName(entity.getClass().getSimpleName());
            Object id = em.getEntityManagerFactory().getPersistenceUnitUtil().getIdentifier(entity);
            if (id instanceof Long) {
                audit.setRecordId((Long) id);
            }
            audit.setAction(action);
            audit.setChangedBy(SecurityContextHolder.getContext().getAuthentication() != null
                    ? SecurityContextHolder.getContext().getAuthentication().getName() : "system");
            audit.setChangeDate(LocalDateTime.now());
            audit.setOldValue(oldValue);

            ObjectMapper mapper = new ObjectMapper();
            try {
                String jsonNewValue = mapper.writeValueAsString(entity);
                audit.setNewValue(jsonNewValue);
            } catch (Exception e) {
                audit.setNewValue("Serialization failed");
            }

            em.persist(audit);
            tx.commit();
        } catch (Exception e) {
            if (tx.isActive()) tx.rollback();
            e.printStackTrace();
        }
    }
}
