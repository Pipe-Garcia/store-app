package com.appTest.store.controllers;

import com.appTest.store.dto.cash.*;
import com.appTest.store.models.cash.CashMovement;
import com.appTest.store.models.cash.CashSession;
import com.appTest.store.repositories.cash.CashMovementRepository;
import com.appTest.store.repositories.cash.CashSessionRepository;
import com.appTest.store.services.CashService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/cash")
@RequiredArgsConstructor
public class CashController {

    private final CashService cashService;
    private final CashSessionRepository sessionRepo;
    private final CashMovementRepository movementRepo;

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
        LocalDate today = LocalDate.now();
        var opt = sessionRepo.findFirstByBusinessDateAndStatus(today, CashSession.Status.OPEN);
        return opt.map(CashSessionDTO::from).orElse(null);
    }

    // usado por el front: 200 con sesión abierta o 204 si no hay
    @GetMapping("/sessions/open")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public org.springframework.http.ResponseEntity<CashSessionDTO> openSession() {
        LocalDate today = LocalDate.now();
        var opt = sessionRepo.findFirstByBusinessDateAndStatus(today, CashSession.Status.OPEN);
        return opt.map(s -> org.springframework.http.ResponseEntity.ok(CashSessionDTO.from(s)))
                .orElseGet(() -> org.springframework.http.ResponseEntity.noContent().build());
    }

    // ✅ NUEVO: sugerido para apertura (carryOverCash del último cierre)
    @GetMapping("/sessions/suggest-opening")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public java.math.BigDecimal suggestOpening(){
        return cashService.suggestOpeningCash();
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public CashSummaryDTO summary(@RequestParam(required = false) LocalDate date){
        LocalDate d = (date != null) ? date : LocalDate.now();

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
        BigDecimal cashOut = movementRepo.sumCashOut(d); // SOLO EXPENSE
        BigDecimal systemCashExpected = opening.add(cashIn).subtract(cashOut);

        return new CashSummaryDTO(d, opening, systemCashExpected, rows);
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

    // listado paginado
    @GetMapping("/movements")
    @PreAuthorize("hasAnyAuthority('ROLE_OWNER','ROLE_CASHIER')")
    public Page<CashMovementDTO> listMovements(
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

        return movementRepo.search(from, to, dirEnum, reasonEnum, method, pg)
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