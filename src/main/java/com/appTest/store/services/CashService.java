package com.appTest.store.services;

import com.appTest.store.models.Payment;
import com.appTest.store.models.cash.CashMovement;
import com.appTest.store.models.cash.CashSession;
import com.appTest.store.repositories.cash.CashMovementRepository;
import com.appTest.store.repositories.cash.CashSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.*;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CashService {

    private static final ZoneId AR_TZ = ZoneId.of("America/Argentina/Buenos_Aires");

    private final CashSessionRepository sessionRepo;
    private final CashMovementRepository movementRepo;

    private static BigDecimal nz(BigDecimal v){ return v != null ? v : BigDecimal.ZERO; }

    private LocalDate todayAR(){ return LocalDate.now(AR_TZ); }

    // ✅ guardamos hora Argentina en DB (LocalDateTime "AR")
    private LocalDateTime nowAR(){ return ZonedDateTime.now(AR_TZ).toLocalDateTime(); }

    private String currentUser(){
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null) ? auth.getName() : "system";
    }

    private boolean isOwner(){
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a -> "ROLE_OWNER".equals(a.getAuthority()));
    }

    public static String normalizeMethod(String raw){
        if (raw == null) return "OTHER";
        String s = raw.trim().toUpperCase(Locale.ROOT);

        if (s.equals("CASH") || s.equals("TRANSFER") || s.equals("CARD") || s.equals("OTHER")) return s;

        if (s.contains("EFECTIVO")) return "CASH";
        if (s.contains("TRANSFER")) return "TRANSFER";
        if (s.contains("TARJ") || s.contains("DEBIT") || s.contains("CRÉDIT") || s.contains("CREDI")) return "CARD";

        return "OTHER";
    }

    /**
     * Si quedó una sesión OPEN de un día anterior, la cerramos sola:
     * - countedCash = systemCash (asumimos sin diferencia)
     * - withdrawalCash = 0
     * - carryOverCash = systemCash
     */
    @Transactional
    public void autoCloseStaleOpenSessionIfAny(){
        LocalDate today = todayAR();

        var staleOpt = sessionRepo.findTopByStatusAndBusinessDateLessThanOrderByBusinessDateDescIdDesc(
                CashSession.Status.OPEN, today
        );

        if (staleOpt.isEmpty()) return;

        CashSession s = staleOpt.get();
        LocalDate d = s.getBusinessDate();

        BigDecimal opening = nz(s.getOpeningCash());
        BigDecimal cashIn  = nz(movementRepo.sumCashIn(d));
        BigDecimal cashOut = nz(movementRepo.sumCashOut(d));

        BigDecimal systemCash = opening.add(cashIn).subtract(cashOut);

        s.setSystemCash(systemCash);
        s.setCountedCash(systemCash);
        s.setDifferenceCash(BigDecimal.ZERO);

        s.setWithdrawalCash(BigDecimal.ZERO);
        s.setCarryOverCash(systemCash);

        s.setClosedAt(nowAR());
        s.setClosedBy("system");
        s.setStatus(CashSession.Status.CLOSED);

        String note = (s.getNote() == null ? "" : s.getNote().trim());
        String extra = "Cierre automático: sesión OPEN de día anterior";
        s.setNote(note.isBlank() ? extra : (note + " · " + extra));

        sessionRepo.save(s);
    }

    private void ensureNotClosedToday(LocalDate today){
        sessionRepo.findTopByBusinessDateOrderByIdDesc(today).ifPresent(s -> {
            if (s.getStatus() == CashSession.Status.CLOSED){
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "La caja ya fue CERRADA hoy. No se puede reabrir hasta mañana."
                );
            }
        });
    }


    /**
     * ✅ Asegura una sesión para una fecha (para poder colgar movimientos).
     * Prioridad:
     *  1) Si hay OPEN ese día → usarla
     *  2) Si hay alguna sesión (CLOSED) ese día → usarla
     *  3) Si no hay ninguna:
     *     - si es HOY → crea OPEN con openingCash sugerido (carryOver)
     *     - si es otra fecha → crea CLOSED “técnica” para trazabilidad
     */
    @Transactional
    public CashSession ensureSessionForDate(LocalDate businessDate, String noteForAutoCreate){
        autoCloseStaleOpenSessionIfAny();

        LocalDate d = (businessDate != null) ? businessDate : todayAR();

        var open = sessionRepo.findFirstByBusinessDateAndStatus(d, CashSession.Status.OPEN);
        if (open.isPresent()) return open.get();

        var any = sessionRepo.findTopByBusinessDateOrderByIdDesc(d);
        if (any.isPresent()) return any.get();

        CashSession s = new CashSession();
        s.setBusinessDate(d);
        s.setOpenedAt(nowAR());
        s.setOpenedBy("system");
        s.setOpeningCash(BigDecimal.ZERO);
        s.setNote(noteForAutoCreate);

        if (d.equals(todayAR())){
            // ✅ “inicio del día” automático (para permitir movimientos aunque nadie haya abierto todavía)
            s.setStatus(CashSession.Status.OPEN);
            s.setOpenedBy(currentUser());
            s.setOpeningCash(suggestOpeningCash());
        } else {
            // ✅ sesión técnica histórica
            s.setStatus(CashSession.Status.CLOSED);
            s.setClosedAt(nowAR());
            s.setClosedBy("system");
            s.setSystemCash(BigDecimal.ZERO);
            s.setCountedCash(BigDecimal.ZERO);
            s.setDifferenceCash(BigDecimal.ZERO);
            s.setWithdrawalCash(BigDecimal.ZERO);
            s.setCarryOverCash(BigDecimal.ZERO);
        }

        return sessionRepo.save(s);
    }

    @Transactional
    public CashSession openToday(BigDecimal openingCash, String note){
        autoCloseStaleOpenSessionIfAny();

        LocalDate today = todayAR();

        ensureNotClosedToday(today);

        var existing = sessionRepo.findFirstByBusinessDateAndStatus(today, CashSession.Status.OPEN);
        if (existing.isPresent()) return existing.get();

        CashSession s = new CashSession();
        s.setBusinessDate(today);
        s.setStatus(CashSession.Status.OPEN);
        s.setOpenedAt(nowAR());
        s.setOpenedBy(currentUser());
        s.setOpeningCash(nz(openingCash));
        s.setNote(note);

        return sessionRepo.save(s);
    }

    @Transactional
    public CashSession requireOpenTodayOrAutoOpenForOwner(){
        autoCloseStaleOpenSessionIfAny();

        LocalDate today = todayAR();

        ensureNotClosedToday(today);

        return sessionRepo.findFirstByBusinessDateAndStatus(today, CashSession.Status.OPEN)
                .orElseGet(() -> {
                    if (isOwner()){
                        return openToday(BigDecimal.ZERO, "Apertura automática (registro de caja)");
                    }
                    throw new IllegalStateException("Caja cerrada. Abrí caja para registrar movimientos.");
                });
    }

    /**
     * Cierre:
     * - systemCash = opening + cashIn(CASH) - cashOut(EXPENSE CASH)
     * - difference = counted - systemCash
     * - carryOverCash = counted - withdrawal
     * - withdrawal NO es gasto => lo registramos como movimiento WITHDRAWAL (para trazabilidad),
     *   pero en sumCashOut() NO cuenta porque ese query filtra reason=EXPENSE.
     */
    @Transactional
    public CashSession closeToday(BigDecimal countedCash, BigDecimal withdrawalCash, String note){
        autoCloseStaleOpenSessionIfAny();

        LocalDate today = todayAR();

        CashSession s = sessionRepo.findFirstByBusinessDateAndStatus(today, CashSession.Status.OPEN)
                .orElseThrow(() -> new IllegalStateException("No hay caja abierta para el día de hoy."));

        BigDecimal opening = nz(s.getOpeningCash());
        BigDecimal cashIn  = nz(movementRepo.sumCashIn(today));
        BigDecimal cashOut = nz(movementRepo.sumCashOut(today)); // SOLO EXPENSE

        BigDecimal systemCash = opening.add(cashIn).subtract(cashOut);

        BigDecimal counted = nz(countedCash);
        BigDecimal withdrawal = nz(withdrawalCash);

        if (withdrawal.signum() < 0) throw new IllegalArgumentException("El retiro no puede ser negativo.");
        if (withdrawal.compareTo(counted) > 0) {
            throw new IllegalArgumentException("El retiro no puede ser mayor al efectivo contado.");
        }

        BigDecimal diff = counted.subtract(systemCash);
        BigDecimal carryOver = counted.subtract(withdrawal);

        s.setClosedAt(nowAR());
        s.setClosedBy(currentUser());
        s.setCountedCash(counted);
        s.setSystemCash(systemCash);
        s.setDifferenceCash(diff);

        s.setWithdrawalCash(withdrawal);
        s.setCarryOverCash(carryOver);

        s.setStatus(CashSession.Status.CLOSED);
        if (note != null && !note.isBlank()) s.setNote(note);

        CashSession saved = sessionRepo.save(s);

        // ✅ trazabilidad del retiro (no es gasto)
        if (withdrawal.signum() > 0) {
            CashMovement m = new CashMovement();
            m.setSession(saved);
            m.setBusinessDate(today);
            m.setTimestamp(nowAR());
            m.setDirection(CashMovement.Direction.OUT);
            m.setAmount(withdrawal);
            m.setMethod("CASH");
            m.setReason(CashMovement.Reason.WITHDRAWAL);
            m.setSourceType("CashSession");
            m.setSourceId(saved.getId());
            m.setUserName(currentUser());
            m.setNote("Retiro al cierre");
            movementRepo.save(m);
        }

        return saved;
    }

    // ✅ cobro de venta => IN
    @Transactional
    public void recordSalePayment(Payment payment){
        if (payment == null || payment.getSale() == null) return;

        CashSession session = requireOpenTodayOrAutoOpenForOwner();
        LocalDate today = todayAR();

        CashMovement m = new CashMovement();
        m.setSession(session);
        m.setBusinessDate(today);
        m.setTimestamp(nowAR());
        m.setDirection(CashMovement.Direction.IN);
        m.setAmount(nz(payment.getAmount()));
        m.setMethod(normalizeMethod(payment.getMethodPayment()));
        m.setReason(CashMovement.Reason.SALE_PAYMENT);
        m.setSourceType("Sale");
        m.setSourceId(payment.getSale().getIdSale());
        m.setUserName(currentUser());
        m.setNote(null); // nota limpia (concepto lo arma el front)
        movementRepo.save(m);
    }

    // ✅ gasto manual => SIEMPRE CASH
    @Transactional
    public CashMovement recordExpense(BigDecimal amount, String note, String reference){
        if (amount == null || amount.signum() <= 0){
            throw new IllegalArgumentException("Amount must be > 0");
        }
        if (note == null || note.isBlank()){
            throw new IllegalArgumentException("Note (reason) is required");
        }

        CashSession session = requireOpenTodayOrAutoOpenForOwner();
        LocalDate today = todayAR();

        CashMovement m = new CashMovement();
        m.setSession(session);
        m.setBusinessDate(today);
        m.setTimestamp(nowAR());
        m.setDirection(CashMovement.Direction.OUT);
        m.setAmount(amount);
        m.setMethod("CASH"); // ✅ caja física
        m.setReason(CashMovement.Reason.EXPENSE);
        m.setSourceType("Manual");
        m.setSourceId(null);
        m.setUserName(currentUser());

        String n = note.trim();
        if (reference != null && !reference.isBlank()){
            n = n + " · Ref: " + reference.trim();
        }
        m.setNote(n);

        return movementRepo.save(m);
    }

    // ✅ sugerencia de apertura: carryOverCash de la última sesión cerrada
    @Transactional(readOnly = true)
    public BigDecimal suggestOpeningCash(){
        return sessionRepo.findTopByStatusOrderByBusinessDateDescIdDesc(CashSession.Status.CLOSED)
                .map(s -> nz(s.getCarryOverCash()))
                .orElse(BigDecimal.ZERO);
    }

    /* ============================================================
       ✅ NUEVO: COMPRAS como egreso automático (NO caja física)
       - method: OTHER
       - reason: PURCHASE
       - direction: OUT
       ============================================================ */

    @Transactional
    public void recordPurchaseOut(Long purchaseId, LocalDate businessDate, BigDecimal amount, String supplierName){
        if (purchaseId == null) return;
        if (amount == null || amount.signum() <= 0) return;

        CashSession session = ensureSessionForDate(
                businessDate,
                "Sesión automática (registro de compra)"
        );

        LocalDate d = (businessDate != null) ? businessDate : todayAR();

        CashMovement m = new CashMovement();
        m.setSession(session);
        m.setBusinessDate(d);
        m.setTimestamp(nowAR());
        m.setDirection(CashMovement.Direction.OUT);

        m.setAmount(amount);
        m.setMethod("OTHER"); // ✅ NO impacta caja física
        m.setReason(CashMovement.Reason.PURCHASE);

        m.setSourceType("Purchase");
        m.setSourceId(purchaseId);
        m.setUserName(currentUser());

        String prov = (supplierName != null && !supplierName.isBlank()) ? supplierName.trim() : "—";
        m.setNote("Compra #" + purchaseId + " · Proveedor: " + prov);

        movementRepo.save(m);
    }

    /**
     * ✅ Anulación de compra:
     * registramos el reverso como IN / PURCHASE / OTHER
     * (deja trazabilidad y en el resumen del día se “compensa”).
     */
    @Transactional
    public void recordPurchaseCancel(Long purchaseId, LocalDate businessDate, BigDecimal amount, String supplierName){
        if (purchaseId == null) return;
        if (amount == null || amount.signum() <= 0) return;

        CashSession session = ensureSessionForDate(
                businessDate,
                "Sesión automática (anulación de compra)"
        );

        LocalDate d = (businessDate != null) ? businessDate : todayAR();

        CashMovement m = new CashMovement();
        m.setSession(session);
        m.setBusinessDate(d);
        m.setTimestamp(nowAR());
        m.setDirection(CashMovement.Direction.IN);

        m.setAmount(amount);
        m.setMethod("OTHER");
        m.setReason(CashMovement.Reason.PURCHASE);

        m.setSourceType("Purchase");
        m.setSourceId(purchaseId);
        m.setUserName(currentUser());

        String prov = (supplierName != null && !supplierName.isBlank()) ? supplierName.trim() : "—";
        m.setNote("Anulación compra #" + purchaseId + " · Proveedor: " + prov);

        movementRepo.save(m);
    }
}