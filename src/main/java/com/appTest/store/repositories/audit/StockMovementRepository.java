// src/main/java/com/appTest/store/repositories/audit/StockMovementRepository.java
package com.appTest.store.repositories.audit;

import com.appTest.store.models.audit.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StockMovementRepository
        extends JpaRepository<StockMovement, Long>,
        JpaSpecificationExecutor<StockMovement> {

    @Query("""
      select m.reason, count(m)
      from StockMovement m
      where m.timestamp >= :from and m.timestamp < :to
      group by m.reason
    """)
    List<Object[]> countByReasonBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
