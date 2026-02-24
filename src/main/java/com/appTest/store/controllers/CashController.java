package com.appTest.store.controllers;

import com.appTest.store.dto.cash.*;
import com.appTest.store.models.cash.CashMovement;
import com.appTest.store.models.cash.CashSession;
import com.appTest.store.repositories.cash.CashMovementRepository;
import com.appTest.store.repositories.cash.CashSessionRepository;
import com.appTest.store.services.CashService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@RestController
@RequestMapping("/cash")
@RequiredArgsConstructor
public class CashController {

    private static final ZoneId AR_TZ = ZoneId.of("America/Argentina/Buenos_Aires");

    private final CashService cashService;
    private final CashSessionRepository sessionRepo;
    private final CashMovementRepository movementRepo;

    private LocalDate todayAR(){ return LocalDate.now(AR_TZ); }

    private static BigDecimal nz(BigDecimal v){ return v != null ? v : BigDecimal.ZERO; }

    @PostMapping("/sessions/open")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public CashSessionDTO open(@RequestBody @Valid CashOpenDTO dto){
        CashSession s = cashService.openToday(dto.getOpeningCash(), dto.getNote());
        return CashSessionDTO.from(s);
    }

    @PostMapping("/sessions/close")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public CashSessionDTO close(@RequestBody @Valid CashCloseDTO dto){
        CashSession s = cashService.closeToday(dto.getCountedCash(), dto.getWithdrawalCash(), dto.getNote());
        return CashSessionDTO.from(s);
    }

    // sesión abierta de HOY
    @GetMapping("/sessions/today")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public CashSessionDTO today(){
        LocalDate today = todayAR();
        var opt = sessionRepo.findFirstByBusinessDateAndStatus(today, CashSession.Status.OPEN);
        return opt.map(CashSessionDTO::from).orElse(null);
    }

    // usado por el front: 200 con sesión abierta o 204 si no hay
    @GetMapping("/sessions/open")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public org.springframework.http.ResponseEntity<CashSessionDTO> openSession() {
        LocalDate today = todayAR();
        var opt = sessionRepo.findFirstByBusinessDateAndStatus(today, CashSession.Status.OPEN);
        return opt.map(s -> org.springframework.http.ResponseEntity.ok(CashSessionDTO.from(s)))
                .orElseGet(() -> org.springframework.http.ResponseEntity.noContent().build());
    }

    // ✅ sugerido para apertura (carryOverCash del último cierre)
    @GetMapping("/sessions/suggest-opening")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public BigDecimal suggestOpening(){
        return cashService.suggestOpeningCash();
    }

    // ✅ HISTÓRICO: obtener sesión por ID (para encabezado "readonly")
    @GetMapping("/sessions/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public CashSessionDTO getSession(@PathVariable Long id){
        CashSession s = sessionRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("CashSession not found: " + id));
        return CashSessionDTO.from(s);
    }

    // ✅ HISTÓRICO: listado de sesiones cerradas con neto
    @GetMapping("/sessions/history")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public Page<CashSessionHistoryRowDTO> history(
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ){
        LocalDate toD = (to != null) ? to : todayAR();
        LocalDate fromD = (from != null) ? from : toD.minusDays(30);

        Pageable pgReq = PageRequest.of(page, size);
        Page<CashSession> pg = sessionRepo.findByStatusAndBusinessDateBetweenOrderByBusinessDateDescIdDesc(
                CashSession.Status.CLOSED, fromD, toD, pgReq
        );

        List<CashSession> sessions = pg.getContent();
        if (sessions.isEmpty()){
            return new PageImpl<>(List.of(), pgReq, pg.getTotalElements());
        }

        List<Long> ids = sessions.stream().map(CashSession::getId).toList();

        // map sessionId -> [income, expense, purchase, withdrawal]
        Map<Long, BigDecimal[]> totals = new HashMap<>();
        for (Object[] r : movementRepo.sumTotalsBySessionIds(ids)){
            Long sid = (Long) r[0];
            BigDecimal income = (BigDecimal) r[1];
            BigDecimal expense = (BigDecimal) r[2];
            BigDecimal purchase = (BigDecimal) r[3];
            BigDecimal withdrawal = (BigDecimal) r[4];
            totals.put(sid, new BigDecimal[]{ nz(income), nz(expense), nz(purchase), nz(withdrawal) });
        }

        List<CashSessionHistoryRowDTO> out = new ArrayList<>(sessions.size());
        for (CashSession s : sessions){
            BigDecimal[] t = totals.getOrDefault(s.getId(),
                    new BigDecimal[]{ BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO });

            BigDecimal income = t[0];
            BigDecimal expense = t[1];
            BigDecimal purchase = t[2];

            // ✅ neto del día: ingresos - (gastos + compras)  (retiro NO afecta neto)
            BigDecimal net = income.subtract(expense.add(purchase));

            out.add(new CashSessionHistoryRowDTO(
                    s.getId(),
                    s.getBusinessDate(),
                    s.getOpenedAt(),
                    nz(s.getOpeningCash()),
                    s.getClosedAt(),
                    s.getClosedBy(),
                    income,
                    expense,
                    purchase,
                    net,
                    nz(s.getWithdrawalCash()),
                    nz(s.getCarryOverCash())
            ));
        }

        return new PageImpl<>(out, pgReq, pg.getTotalElements());
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public CashSummaryDTO summary(@RequestParam(required = false) LocalDate date){
        LocalDate d = (date != null) ? date : todayAR();

        BigDecimal opening = sessionRepo.findTopByBusinessDateOrderByIdDesc(d)
                .map(CashSession::getOpeningCash)
                .orElse(BigDecimal.ZERO);

        List<Object[]> rowsRaw = movementRepo.sumByDirectionAndMethod(d);
        List<CashSummaryRowDTO> rows = new ArrayList<>();
        for (Object[] r : rowsRaw){
            String dir = String.valueOf(r[0]);
            String method = String.valueOf(r[1]);
            BigDecimal total = (BigDecimal) r[2];
            rows.add(new CashSummaryRowDTO(dir, method, total));
        }

        BigDecimal cashIn  = movementRepo.sumCashIn(d);
        BigDecimal cashOut = movementRepo.sumCashOut(d); // SOLO EXPENSE CASH
        BigDecimal systemCashExpected = opening.add(cashIn).subtract(cashOut);

        return new CashSummaryDTO(d, opening, systemCashExpected, rows);
    }

    @GetMapping("/sessions/by-date")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public ResponseEntity<CashSessionDTO> sessionByDate(@RequestParam LocalDate date){
        return sessionRepo.findTopByBusinessDateOrderByIdDesc(date)
                .map(s -> ResponseEntity.ok(CashSessionDTO.from(s)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    // gasto manual (método lo fuerza el back a CASH)
    @PostMapping("/expenses")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public CashMovementDTO createExpense(@RequestBody @Valid CashExpenseCreateDTO dto){
        CashMovement m = cashService.recordExpense(
                dto.getAmount(),
                dto.getNote(),
                dto.getReference()
        );

        return new CashMovementDTO(
                m.getId(),
                m.getSession().getId(),
                m.getBusinessDate(),
                m.getTimestamp(),
                m.getDirection().name(),
                m.getAmount(),
                m.getMethod(),
                m.getReason().name(),
                m.getSourceType(),
                m.getSourceId(),
                m.getUserName(),
                m.getNote()
        );
    }

    // ✅ listado paginado (ahora acepta sessionId para histórico)
    @GetMapping("/movements")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public Page<CashMovementDTO> listMovements(
            @RequestParam(required = false) Long sessionId,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            @RequestParam(required = false) String direction,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false) String method,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ){
        CashMovement.Direction dirEnum = null;
        CashMovement.Reason reasonEnum = null;

        if (direction != null && !direction.isBlank()){
            dirEnum = CashMovement.Direction.valueOf(direction.trim().toUpperCase());
        }
        if (reason != null && !reason.isBlank()){
            reasonEnum = CashMovement.Reason.valueOf(reason.trim().toUpperCase());
        }

        var pg = PageRequest.of(page, size);

        return movementRepo.search(sessionId, from, to, dirEnum, reasonEnum, method, pg)
                .map(m -> new CashMovementDTO(
                        m.getId(),
                        m.getSession().getId(),
                        m.getBusinessDate(),
                        m.getTimestamp(),
                        m.getDirection().name(),
                        m.getAmount(),
                        m.getMethod(),
                        m.getReason().name(),
                        m.getSourceType(),
                        m.getSourceId(),
                        m.getUserName(),
                        m.getNote()
                ));
    }
}