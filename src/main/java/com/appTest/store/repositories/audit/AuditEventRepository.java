// src/main/java/com/appTest/store/repositories/audit/AuditEventRepository.java
package com.appTest.store.repositories.audit;

import com.appTest.store.models.audit.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AuditEventRepository
        extends JpaRepository<AuditEvent, Long>,
        JpaSpecificationExecutor<AuditEvent> {

    // Conteos simples en rangos
    @Query("select count(e) from AuditEvent e where e.timestamp >= :from and e.timestamp < :to")
    long countBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("select count(e) from AuditEvent e where e.status = 'SUCCESS' and e.timestamp >= :from and e.timestamp < :to")
    long countSuccessBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("select count(distinct e.actorName) from AuditEvent e where e.timestamp >= :from and e.timestamp < :to")
    long countDistinctActorsBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    // Acciones sensibles (DELETE, ADJUST, BULK_%)
    @Query("""
      select count(e)
      from AuditEvent e
      where e.timestamp >= :from and e.timestamp < :to
        and (
              e.action in ('DELETE','ADJUST')
              or e.action like 'BULK_%'
            )
    """)
    long countSensitiveBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    // Último FAIL
    Optional<AuditEvent> findTopByStatusOrderByTimestampDesc(String status);

    // Serie diaria 30d (usa function('date', ...) para truncar a día en JPQL)
    @Query("""
      select function('date', e.timestamp) as d,
             sum(case when e.status='SUCCESS' then 1 else 0 end),
             sum(case when e.status='FAIL'    then 1 else 0 end)
      from AuditEvent e
      where e.timestamp >= :from
      group by function('date', e.timestamp)
      order by function('date', e.timestamp)
    """)
    List<Object[]> dailySuccessFailFrom(@Param("from") LocalDateTime from);

    // Últimos críticos (para la mini tabla)
    @Query("""
      select e
      from AuditEvent e
      where
         (e.action in ('DELETE','ADJUST') or e.action like 'BULK_%')
         or (e.entity = 'Stock' and e.action = 'UPDATE')
      order by e.timestamp desc
    """)
    List<AuditEvent> latestCritical(org.springframework.data.domain.Pageable pageable);
}
