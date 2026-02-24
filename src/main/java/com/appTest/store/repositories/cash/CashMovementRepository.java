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
        and m.reason in ('EXPENSE', 'SALE_CANCEL')
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

    // ✅ HISTÓRICO: totales por session_id (neto del día)
    // r[0]=sessionId, r[1]=income, r[2]=expense, r[3]=purchase, r[4]=withdrawal
    @Query("""
      select
        m.session.id,
        coalesce(sum(case when m.direction='IN' then m.amount else 0 end), 0),
        coalesce(sum(case when m.direction='OUT' and m.reason='EXPENSE' then m.amount else 0 end), 0),
        coalesce(sum(case when m.direction='OUT' and m.reason='PURCHASE' then m.amount else 0 end), 0),
        coalesce(sum(case when m.direction='OUT' and m.reason='WITHDRAWAL' then m.amount else 0 end), 0)
      from CashMovement m
      where m.session.id in :sessionIds
      group by m.session.id
    """)
    List<Object[]> sumTotalsBySessionIds(@Param("sessionIds") List<Long> sessionIds);

    // ✅ listado paginado + filtros opcionales (+ sessionId para "ver movimientos" del histórico)
    @Query("""
      select m
      from CashMovement m
      where (:sessionId is null or m.session.id = :sessionId)
        and (:from is null or m.businessDate >= :from)
        and (:to is null or m.businessDate <= :to)
        and (:direction is null or m.direction = :direction)
        and (:reason is null or m.reason = :reason)
        and (:method is null or upper(m.method) = upper(:method))
      order by m.timestamp desc
    """)
    Page<CashMovement> search(
            @Param("sessionId") Long sessionId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("direction") CashMovement.Direction direction,
            @Param("reason") CashMovement.Reason reason,
            @Param("method") String method,
            Pageable pageable
    );

    // === Dashboard Finanzas: series por día / breakdowns ===

    @Query("""
  select m.businessDate, m.direction, m.reason, coalesce(sum(m.amount), 0)
  from CashMovement m
  where m.businessDate between :from and :to
  group by m.businessDate, m.direction, m.reason
  order by m.businessDate asc
""")
    List<Object[]> sumByDateDirectionReasonBetween(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    @Query("""
  select upper(m.method), coalesce(sum(m.amount), 0)
  from CashMovement m
  where m.businessDate between :from and :to
    and m.direction = 'IN'
  group by upper(m.method)
  order by upper(m.method)
""")
    List<Object[]> sumInByMethodBetween(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    @Query("""
  select m.reason, coalesce(sum(m.amount), 0)
  from CashMovement m
  where m.businessDate between :from and :to
    and m.direction = 'OUT'
  group by m.reason
  order by m.reason
""")
    List<Object[]> sumOutByReasonBetween(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );
}