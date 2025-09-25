package com.appTest.store.controllers;

import com.appTest.store.dto.reservation.BulkReservationRequest;
import com.appTest.store.dto.reservation.ConsumeRequestDTO;
import com.appTest.store.dto.reservation.StockReservationCreateDTO;
import com.appTest.store.dto.reservation.StockReservationDTO;
import com.appTest.store.models.enums.ReservationStatus;
import com.appTest.store.services.IStockReservationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

// StockReservationController.java
@RestController
@RequestMapping("/stock-reservations")
@RequiredArgsConstructor
public class StockReservationController {

    private final IStockReservationService serv;

    @PostMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')") // sin prefijo ROLE_
    public ResponseEntity<StockReservationDTO> create(@RequestBody @Valid StockReservationCreateDTO dto){
        return ResponseEntity.status(HttpStatus.CREATED).body(serv.create(dto));
    }


    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<List<StockReservationDTO>> bulk(@RequestBody @Valid BulkReservationRequest req) {
        return ResponseEntity.ok(serv.bulkCreate(req));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<List<StockReservationDTO>> search(
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String status
    ){
        var st = (status==null || status.isBlank()) ? null
                : com.appTest.store.models.enums.ReservationStatus.valueOf(status.toUpperCase());
        return ResponseEntity.ok(serv.search(clientId, orderId, st));
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<Void> cancel(@PathVariable Long id){
        serv.cancel(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/expire-now")
    @PreAuthorize("hasRole('OWNER')") // sólo dueño
    public ResponseEntity<String> expireNow(){
        int n = serv.expireNow();
        return ResponseEntity.ok("Expired: "+n);
    }
}


