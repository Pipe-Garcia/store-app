package com.appTest.store.repositories.cash;

import com.appTest.store.models.cash.CashMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface CashMovementRepository extends JpaRepository<CashMovement, Long> {

    @Query("""
      select m.direction, m.method, sum(m.amount)
      from CashMovement m
      where m.businessDate = :date
      group by m.direction, m.method
    """)
    List<Object[]> sumByDirectionAndMethod(@Param("date") LocalDate date);

    // ✅ ingresos de EFECTIVO (por pagos de venta en CASH)
    @Query("""
      select coalesce(sum(m.amount), 0)
      from CashMovement m
      where m.businessDate = :date
        and m.direction = 'IN'
        and upper(m.method) = 'CASH'
    """)
    java.math.BigDecimal sumCashIn(@Param("date") LocalDate date);

    // ✅ egresos de EFECTIVO (solo gastos reales, NO retiro)
    @Query("""
      select coalesce(sum(m.amount), 0)
      from CashMovement m
      where m.businessDate = :date
        and m.direction = 'OUT'
        and upper(m.method) = 'CASH'
        and m.reason = 'EXPENSE'
    """)
    java.math.BigDecimal sumCashOut(@Param("date") LocalDate date);

    // ✅ retiro separado (para mostrar y para lógica de cierre)
    @Query("""
      select coalesce(sum(m.amount), 0)
      from CashMovement m
      where m.businessDate = :date
        and m.direction = 'OUT'
        and upper(m.method) = 'CASH'
        and m.reason = 'WITHDRAWAL'
    """)
    java.math.BigDecimal sumCashWithdrawal(@Param("date") LocalDate date);

    @Query("""
      select m
      from CashMovement m
      where (:from is null or m.businessDate >= :from)
        and (:to is null or m.businessDate <= :to)
        and (:direction is null or m.direction = :direction)
        and (:reason is null or m.reason = :reason)
        and (:method is null or upper(m.method) = upper(:method))
      order by m.timestamp desc
    """)
    Page<CashMovement> search(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("direction") CashMovement.Direction direction,
            @Param("reason") CashMovement.Reason reason,
            @Param("method") String method,
            Pageable pageable
    );
}