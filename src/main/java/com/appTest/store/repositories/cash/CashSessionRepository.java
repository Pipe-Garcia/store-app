package com.appTest.store.repositories.cash;

import com.appTest.store.models.cash.CashSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CashSessionRepository extends JpaRepository<CashSession, Long> {

    Optional<CashSession> findTopByBusinessDateOrderByIdDesc(LocalDate businessDate);

    Optional<CashSession> findFirstByBusinessDateAndStatus(LocalDate businessDate, CashSession.Status status);

    // ✅ última sesión CERRADA (para sugerir apertura)
    Optional<CashSession> findTopByStatusOrderByBusinessDateDescIdDesc(CashSession.Status status);

    // ✅ si quedó una sesión OPEN de un día anterior, la más reciente
    Optional<CashSession> findTopByStatusAndBusinessDateLessThanOrderByBusinessDateDescIdDesc(
            CashSession.Status status,
            LocalDate dateExclusive
    );

    // ✅ HISTÓRICO: sesiones cerradas por rango de fechas (paginado)
    Page<CashSession> findByStatusAndBusinessDateBetweenOrderByBusinessDateDescIdDesc(
            CashSession.Status status,
            LocalDate from,
            LocalDate to,
            Pageable pageable
    );

    List<CashSession> findByBusinessDateOrderByIdDesc(LocalDate businessDate);


    List<CashSession> findByStatusOrderByBusinessDateDescIdDesc(CashSession.Status status);

    List<CashSession> findAllByStatusAndBusinessDateBetweenOrderByBusinessDateDescIdDesc(
            CashSession.Status status,
            LocalDate from,
            LocalDate to
    );
}