package com.appTest.store.services;

import com.appTest.store.dto.reservation.BulkReservationItem;
import com.appTest.store.dto.reservation.BulkReservationRequest;
import com.appTest.store.dto.reservation.StockReservationCreateDTO;
import com.appTest.store.dto.reservation.StockReservationDTO;
import com.appTest.store.models.*;
import com.appTest.store.models.enums.ReservationStatus;
import com.appTest.store.repositories.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StockReservationService implements IStockReservationService {

    @Autowired
    private final IStockReservationRepository repoReservation;

    @Autowired
    private final IMaterialRepository repoMaterial;

    @Autowired
    private final IWarehouseRepository repoWarehouse;

    @Autowired
    private final IClientRepository repoClient;

    @Autowired
    private final IOrdersRepository repoOrders;

    @Autowired
    private final IStockService stockService;

    private StockReservationDTO toDto(StockReservation r){
        Long orderId = (r.getOrders()!=null) ? r.getOrders().getIdOrders() : null; // ✅

        return new StockReservationDTO(
                r.getIdReservation(),
                r.getMaterial().getIdMaterial(),
                r.getMaterial().getName(),
                r.getWarehouse().getIdWarehouse(),
                r.getWarehouse().getName(),
                r.getClient()!=null ? r.getClient().getIdClient() : null,
                r.getClient()!=null ? (r.getClient().getName()+" "+r.getClient().getSurname()) : null,
                orderId,                                 // ✅ ahora sale en la respuesta
                r.getQuantity(),
                r.getReservedAt(),
                r.getExpiresAt(),
                r.getStatus().name()
        );
    }


    @Override
    @Transactional
    public List<StockReservationDTO> bulkCreate(BulkReservationRequest req) {
        Orders order = repoOrders.findById(req.orderId())
                .orElseThrow(() -> new EntityNotFoundException("Order not found: " + req.orderId()));

        List<StockReservationDTO> out = new ArrayList<>();

        for (BulkReservationItem it : req.items()) {
            Material  m  = repoMaterial.findById(it.materialId())
                    .orElseThrow(() -> new EntityNotFoundException("Material not found: " + it.materialId()));
            Warehouse w  = repoWarehouse.findById(it.warehouseId())
                    .orElseThrow(() -> new EntityNotFoundException("Warehouse not found: " + it.warehouseId()));

            // (opcional) validaciones de stock disponible…

            StockReservation r = new StockReservation();
            r.setOrders(order);                      // ✅ CLAVE: vincular al pedido
            r.setClient(order.getClient());          // útil para reportes
            r.setMaterial(m);
            r.setWarehouse(w);
            r.setQuantity(it.quantity());
            r.setReservedAt(LocalDate.now());
            r.setStatus(ReservationStatus.ACTIVE);

            repoReservation.save(r);
            out.add(toDto(r));
        }
        return out;
    }


    @Override
    @Transactional
    public StockReservationDTO create(StockReservationCreateDTO dto) {
        Material mat = repoMaterial.findById(dto.getMaterialId())
                .orElseThrow(() -> new EntityNotFoundException("Material not found: "+dto.getMaterialId()));
        Warehouse wh = repoWarehouse.findById(dto.getWarehouseId())
                .orElseThrow(() -> new EntityNotFoundException("Warehouse not found: "+dto.getWarehouseId()));

        if (dto.getQuantity().compareTo(BigDecimal.ZERO) <= 0)
            throw new IllegalArgumentException("Quantity must be > 0");

        // validar que haya stock "reservable" suficiente
        BigDecimal free = stockService.availableForReservation(mat.getIdMaterial(), wh.getIdWarehouse());
        if (dto.getQuantity().compareTo(free) > 0)
            throw new IllegalStateException("Not enough free stock to reserve");

        StockReservation r = new StockReservation();
        r.setMaterial(mat);
        r.setWarehouse(wh);
        if (dto.getClientId()!=null) {
            Client c = repoClient.findById(dto.getClientId())
                    .orElseThrow(() -> new EntityNotFoundException("Client not found: "+dto.getClientId()));
            r.setClient(c);
        }
        Orders order = null;
        if (dto.getOrderId() != null) {
            order = repoOrders.findById(dto.getOrderId())
                    .orElseThrow(() -> new EntityNotFoundException("Order not found: " + dto.getOrderId()));
        }
        r.setOrders(order);
        r.setQuantity(dto.getQuantity());
        r.setReservedAt(LocalDate.now());
        r.setExpiresAt(dto.getExpiresAt());
        r.setStatus(ReservationStatus.ACTIVE);

        return toDto(repoReservation.save(r));
    }

    @Override
    @Transactional(readOnly = true)
    public List<StockReservationDTO> search(Long clientId, Long orderId, ReservationStatus status) {
        List<StockReservationDTO> out = new ArrayList<>();
        for (var r : repoReservation.search(clientId, orderId, status)) out.add(toDto(r));
        return out;
    }

    @Override
    @Transactional
    public void cancel(Long idReservation) {
        StockReservation r = repoReservation.findById(idReservation)
                .orElseThrow(() -> new EntityNotFoundException("Reservation not found: "+idReservation));
        if (r.getStatus() == ReservationStatus.CONSUMED) {
            throw new IllegalStateException("Consumed reservation cannot be cancelled");
        }
        r.setStatus(ReservationStatus.CANCELLED);
        repoReservation.save(r);
    }

    @Override
    @Transactional
    public int expireNow() {
        int count = 0;
        LocalDate today = LocalDate.now();
        for (var r : repoReservation.findByStatus(ReservationStatus.ACTIVE)) {
            if (r.getExpiresAt()!=null && r.getExpiresAt().isBefore(today)) {
                r.setStatus(ReservationStatus.EXPIRED);
                repoReservation.save(r);
                count++;
            }
        }
        return count;
    }

    @Override
@Transactional
public BigDecimal consumeForSale(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId) {
        if (qty == null || qty.signum() <= 0) return BigDecimal.ZERO;
        if (orderId == null) {
            // fallback a la versión existente
            return consumeForSale(clientId, materialId, warehouseId, qty);
        }

        var bag = repoReservation.pickActiveForConsume(clientId, materialId, orderId, warehouseId);
        BigDecimal remaining = qty;
        for (var r : bag) {
            if (remaining.signum() == 0) break;
            var avail = r.getQuantity();
            int cmp = avail.compareTo(remaining);
            if (cmp <= 0) {
                r.setStatus(ReservationStatus.CONSUMED);
                repoReservation.save(r);
                remaining = remaining.subtract(avail);
            } else {
                // consumo parcial: reducción + registro CONSUMED por la parte usada
                r.setQuantity(avail.subtract(remaining));
                repoReservation.save(r);

                var consumed = new StockReservation();
                consumed.setClient(r.getClient());
                consumed.setMaterial(r.getMaterial());
                consumed.setWarehouse(r.getWarehouse());
                consumed.setOrders(r.getOrders());
                consumed.setQuantity(remaining);
                consumed.setStatus(ReservationStatus.CONSUMED);
                consumed.setReservedAt(java.time.LocalDate.now());
                repoReservation.save(consumed);
                remaining = BigDecimal.ZERO;
                break;
            }
        }
        return qty.subtract(remaining); // lo efectivamente consumido de reservas
}

@Override
@Transactional
public BigDecimal consumeForSale(Long clientId, Long materialId, Long warehouseId, BigDecimal qty) {
     // delega en la otra versión (orderId = null)
     return consumeForSale(clientId, materialId, warehouseId, qty, null);
}

@Override
@Transactional
public void recordDirectConsumption(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId){
       if (qty==null || qty.signum()<=0) return;
       var r = new StockReservation();
       var c = new Client(); c.setIdClient(clientId); r.setClient(c);
       var m = new Material(); m.setIdMaterial(materialId); r.setMaterial(m);
        if (warehouseId != null){ var w = new Warehouse(); w.setIdWarehouse(warehouseId); r.setWarehouse(w); }
        if (orderId != null){ var o = new Orders(); o.setIdOrders(orderId); r.setOrders(o); }
            r.setQuantity(qty);
            r.setStatus(ReservationStatus.CONSUMED);
            r.setReservedAt(java.time.LocalDate.now());
            repoReservation.save(r);
        }

    @Override
    @Transactional
    public BigDecimal allocateForSale(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId) {
        if (qty == null || qty.signum() <= 0) return BigDecimal.ZERO;

        BigDecimal remaining = qty;

        // 1) Priorizar reservas ACTIVE (pedido opcional)
        List<StockReservation> bag = repoReservation.pickActiveForAllocate(
                clientId, materialId, warehouseId, orderId
        );
        for (StockReservation r : bag) {
            if (remaining.signum() == 0) break;
            BigDecimal avail = r.getQuantity();

            int cmp = avail.compareTo(remaining);
            if (cmp <= 0) {
                // pasa todo el renglón a ALLOCATED
                r.setStatus(ReservationStatus.ALLOCATED);
                repoReservation.save(r);
                remaining = remaining.subtract(avail);
            } else {
                // split: queda saldo ACTIVE y creo uno ALLOCATED por la parte usada
                r.setQuantity(avail.subtract(remaining));
                repoReservation.save(r);

                StockReservation alloc = new StockReservation();
                alloc.setClient(r.getClient());
                alloc.setMaterial(r.getMaterial());
                alloc.setWarehouse(r.getWarehouse());
                alloc.setOrders(r.getOrders());
                alloc.setQuantity(remaining);
                alloc.setReservedAt(LocalDate.now());
                alloc.setStatus(ReservationStatus.ALLOCATED);
                repoReservation.save(alloc);

                remaining = BigDecimal.ZERO;
                break;
            }
        }

        // 2) Si faltó, crear ALLOCATED directo (bloquea disponibilidad)
        if (remaining.signum() > 0) {
            recordDirectAllocation(clientId, materialId, warehouseId, remaining, orderId);
        }

        return qty;
    }

    @Override
    @Transactional
    public void recordDirectAllocation(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId) {
        if (qty == null || qty.signum() <= 0) return;

        StockReservation r = new StockReservation();
        Client c = new Client(); c.setIdClient(clientId); r.setClient(c);
        Material m = new Material(); m.setIdMaterial(materialId); r.setMaterial(m);
        if (warehouseId != null) { Warehouse w = new Warehouse(); w.setIdWarehouse(warehouseId); r.setWarehouse(w); }
        if (orderId != null) { Orders o = new Orders(); o.setIdOrders(orderId); r.setOrders(o); }

        r.setQuantity(qty);
        r.setReservedAt(LocalDate.now());
        r.setStatus(ReservationStatus.ALLOCATED);
        repoReservation.save(r);
    }

    @Override
    @Transactional
    public BigDecimal shipFromAllocation(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId) {
        if (qty == null || qty.signum() <= 0) return BigDecimal.ZERO;

        BigDecimal remaining = qty;
        List<StockReservation> bag = repoReservation.pickAllocatedForShipment(
                clientId, materialId, warehouseId, orderId
        );

        for (StockReservation r : bag) {
            if (remaining.signum() == 0) break;
            BigDecimal avail = r.getQuantity();

            int cmp = avail.compareTo(remaining);
            if (cmp <= 0) {
                r.setStatus(ReservationStatus.CONSUMED);
                repoReservation.save(r);
                remaining = remaining.subtract(avail);
            } else {
                // split: reduce ALLOCATED y creo CONSUMED por lo entregado
                r.setQuantity(avail.subtract(remaining));
                repoReservation.save(r);

                StockReservation consumed = new StockReservation();
                consumed.setClient(r.getClient());
                consumed.setMaterial(r.getMaterial());
                consumed.setWarehouse(r.getWarehouse());
                consumed.setOrders(r.getOrders());
                consumed.setQuantity(remaining);
                consumed.setReservedAt(LocalDate.now());
                consumed.setStatus(ReservationStatus.CONSUMED);
                repoReservation.save(consumed);

                remaining = BigDecimal.ZERO;
                break;
            }
        }
        return qty.subtract(remaining); // efectivamente pasado a CONSUMED
    }

}


