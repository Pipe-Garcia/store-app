package com.appTest.store.repositories.audit;

import com.appTest.store.models.audit.AuditDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditDetailRepository extends JpaRepository<AuditDetail, Long> {
    List<AuditDetail> findByEventId(Long eventId);
}

