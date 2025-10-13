// src/main/java/com/appTest/store/services/DeliveryService.java
package com.appTest.store.services;

import com.appTest.store.dto.delivery.*;
import com.appTest.store.models.*;
import com.appTest.store.models.enums.DeliveryStatus;
import com.appTest.store.repositories.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeliveryService implements IDeliveryService {

    private final IDeliveryRepository repoDelivery;
    private final IDeliveryItemRepository repoDeliveryItem;
    private final IOrdersRepository repoOrders;
    private final IOrderDetailRepository repoOrderDetail;   
    private final IMaterialRepository repoMaterial;
    private final IWarehouseRepository repoWarehouse;       
    private final IStockService stockService;            

    @Override
    public List<Delivery> getAllDeliveries() {
        return repoDelivery.findAll();
    }

    @Override
    public Delivery getDeliveryById(Long id) {
        return repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));
    }

    @Override
    public DeliveryDTO convertDeliveryToDto(Delivery delivery) {
        String clientName = Optional.ofNullable(delivery.getOrders())
                .map(Orders::getClient).map(Client::getName).orElse("Name not found");
        String clientSurname = Optional.ofNullable(delivery.getOrders())
                .map(Orders::getClient).map(Client::getSurname).orElse("Surname not found");
        String completeName = clientName + " " + clientSurname;

        return new DeliveryDTO(
                delivery.getIdDelivery(),
                delivery.getOrders().getIdOrders(),
                delivery.getDeliveryDate(),
                delivery.getStatus().name(),
                completeName
        );
    }

    /* ---------- helpers ---------- */

    private DeliveryStatus calculateStatusForOrder(Long orderId) {
        Orders orders = repoOrders.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Orders not found with ID: " + orderId));

        BigDecimal totalOrdered = orders.getOrderDetails().stream()
                .map(OrderDetail::getQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalDelivered = repoDeliveryItem.sumDeliveredByOrder(orderId);

        if (totalDelivered.compareTo(BigDecimal.ZERO) == 0) return DeliveryStatus.PENDING;
        if (totalDelivered.compareTo(totalOrdered) < 0)     return DeliveryStatus.PARTIAL;
        return DeliveryStatus.COMPLETED;
    }

    private void ensureDate(Orders orders, LocalDate deliveryDate) {
        if (deliveryDate != null && orders.getDateCreate() != null
                && deliveryDate.isBefore(orders.getDateCreate())) {
            throw new IllegalArgumentException("deliveryDate cannot be before order.dateCreate");
        }
    }

    private BigDecimal deliveredSoFarForDetail(Long orderDetailId) {
        return repoDeliveryItem.sumDeliveredByOrderDetail(orderDetailId);
    }

    public DeliveryDetailDTO getDeliveryDetail(Long id) {
        Delivery d = repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));

        String clientName = (d.getOrders() != null && d.getOrders().getClient() != null)
                ? d.getOrders().getClient().getName() + " " + d.getOrders().getClient().getSurname()
                : "Name not found";

        // mapear items -> DeliveryItemDTO (usando tus campos)
        List<DeliveryItemDTO> items = d.getItems().stream().map(i ->
                new DeliveryItemDTO(
                        i.getIdDeliveryItem(),
                        i.getOrderDetail().getIdOrderDetail(),
                        i.getMaterial().getIdMaterial(),
                        i.getMaterial().getName(),
                        i.getWarehouse() != null ? i.getWarehouse().getIdWarehouse() : null,
                        i.getWarehouse() != null ? i.getWarehouse().getName() : null,
                        i.getOrderDetail().getQuantity(),
                        i.getQuantityDelivered(),
                        i.getUnitPriceSnapshot()
                )
        ).collect(Collectors.toList());

        BigDecimal total = items.stream()
                .map(it -> it.getUnitPriceSnapshot().multiply(it.getQuantityDelivered()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new DeliveryDetailDTO(
                d.getIdDelivery(),
                d.getOrders().getIdOrders(),
                d.getDeliveryDate(),
                d.getStatus().toString(),
                clientName,
                total,
                items
        );
    }

    /* ---------- create ---------- */

    @Override
    @Transactional
    public DeliveryDTO createDelivery(DeliveryCreateDTO dto) {
        Orders orders = repoOrders.findById(dto.getOrdersId())
                .orElseThrow(() -> new EntityNotFoundException("Orders not found with ID: " + dto.getOrdersId()));

        ensureDate(orders, dto.getDeliveryDate());

        Delivery delivery = new Delivery();
        delivery.setOrders(orders);
        delivery.setDeliveryDate(dto.getDeliveryDate());
        delivery.setStatus(DeliveryStatus.PENDING); // se recalcula al final

        List<DeliveryItem> items = new ArrayList<>();

        for (DeliveryItemCreateDTO it : dto.getItems()) {
            OrderDetail od = repoOrderDetail.findById(it.getOrderDetailId())
                    .orElseThrow(() -> new EntityNotFoundException("OrderDetail not found: " + it.getOrderDetailId()));
            if (!Objects.equals(od.getOrders().getIdOrders(), orders.getIdOrders())) {
                throw new IllegalArgumentException("OrderDetail does not belong to the given Order");
            }

            Material mat = repoMaterial.findById(it.getMaterialId())
                    .orElseThrow(() -> new EntityNotFoundException("Material not found: " + it.getMaterialId()));
            if (!Objects.equals(mat.getIdMaterial(), od.getMaterial().getIdMaterial())) {
                throw new IllegalArgumentException("Material does not match OrderDetail");
            }

            BigDecimal deliveredSoFar = deliveredSoFarForDetail(od.getIdOrderDetail());
            BigDecimal pending = od.getQuantity().subtract(deliveredSoFar);
            if (it.getQuantityDelivered().compareTo(pending) > 0) {
                throw new IllegalArgumentException("Quantity exceeds pending for orderDetail " + od.getIdOrderDetail());
            }

            Warehouse wh = null;
            if (it.getWarehouseId() != null) {
                wh = repoWarehouse.findById(it.getWarehouseId())
                        .orElseThrow(() -> new EntityNotFoundException("Warehouse not found: " + it.getWarehouseId()));
            }

            DeliveryItem di = new DeliveryItem();
            di.setDelivery(delivery);
            di.setOrderDetail(od);
            di.setMaterial(mat);
            di.setWarehouse(wh);
            di.setQuantityDelivered(it.getQuantityDelivered());
            di.setUnitPriceSnapshot(mat.getPriceArs()); // snapshot precio actual

            items.add(di);

            // TO-DO stockService.adjust(mat.getIdMaterial(), (wh != null ? wh.getIdWarehouse() : null), it.getQuantityDelivered().negate());
        }

        delivery.setItems(items);

        Delivery saved = repoDelivery.save(delivery);

        // Recalcular estado a nivel pedido y setear en esta entrega:
        DeliveryStatus status = calculateStatusForOrder(orders.getIdOrders());
        saved.setStatus(status);

        return convertDeliveryToDto(saved);
    }

    /* ---------- update (upsert items) ---------- */

    @Override
    @Transactional
    public void updateDelivery(DeliveryUpdateDTO dto) {
        Delivery delivery = repoDelivery.findByIdWithGraph(dto.getIdDelivery())
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + dto.getIdDelivery()));

        Orders orders = delivery.getOrders();
        if (dto.getDeliveryDate() != null) {
            ensureDate(orders, dto.getDeliveryDate());
            delivery.setDeliveryDate(dto.getDeliveryDate());
        }

        // Índices para upsert
        Map<Long, DeliveryItem> byId = delivery.getItems().stream()
                .filter(i -> i.getIdDeliveryItem() != null)
                .collect(Collectors.toMap(DeliveryItem::getIdDeliveryItem, i -> i));

        // Para evitar duplicados por (orderDetailId + materialId)
        Map<String, DeliveryItem> byComposite = delivery.getItems().stream()
                .collect(Collectors.toMap(
                        i -> (i.getOrderDetail().getIdOrderDetail() + "-" + i.getMaterial().getIdMaterial()),
                        i -> i, (a,b)->a));

        Set<Long> keepIds = new HashSet<>();

        if (dto.getItems() != null) {
            for (DeliveryItemUpsertDTO in : dto.getItems()) {
                DeliveryItem target = null;

                if (in.getIdDeliveryItem() != null) {
                    target = byId.get(in.getIdDeliveryItem());
                    if (target == null) {
                        throw new EntityNotFoundException("DeliveryItem not found: " + in.getIdDeliveryItem());
                    }
                } else {
                    // buscar por composite
                    String key = in.getOrderDetailId() + "-" + in.getMaterialId();
                    target = byComposite.get(key);
                }

                if (target != null) {
                    // ajustar stock por delta
                    BigDecimal prev = target.getQuantityDelivered();
                    BigDecimal next = Optional.ofNullable(in.getQuantityDelivered()).orElse(BigDecimal.ZERO);
                    BigDecimal delta = next.subtract(prev); // si < 0 reponemos

                    target.setQuantityDelivered(next);

                    // TO-DO stockService.adjust(target.getMaterial().getIdMaterial(),
                    //         (target.getWarehouse() != null ? target.getWarehouse().getIdWarehouse() : null),
                    //         delta.negate());

                    keepIds.add(target.getIdDeliveryItem());
                } else {
                    // nuevo renglón
                    OrderDetail od = repoOrderDetail.findById(in.getOrderDetailId())
                            .orElseThrow(() -> new EntityNotFoundException("OrderDetail not found: " + in.getOrderDetailId()));
                    if (!Objects.equals(od.getOrders().getIdOrders(), orders.getIdOrders())) {
                        throw new IllegalArgumentException("OrderDetail does not belong to the Delivery's Order");
                    }
                    Material mat = repoMaterial.findById(in.getMaterialId())
                            .orElseThrow(() -> new EntityNotFoundException("Material not found: " + in.getMaterialId()));
                    Warehouse wh = null;
                    if (in.getWarehouseId() != null) {
                        wh = repoWarehouse.findById(in.getWarehouseId())
                                .orElseThrow(() -> new EntityNotFoundException("Warehouse not found: " + in.getWarehouseId()));
                    }

                    BigDecimal deliveredSoFar = deliveredSoFarForDetail(od.getIdOrderDetail());
                    // incluir lo ya entregado en esta misma entrega:
                    BigDecimal inThisDelivery = delivery.getItems().stream()
                            .filter(i -> i.getOrderDetail().getIdOrderDetail().equals(od.getIdOrderDetail()))
                            .map(DeliveryItem::getQuantityDelivered)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal pending = od.getQuantity().subtract(deliveredSoFar).subtract(inThisDelivery);
                    if (in.getQuantityDelivered().compareTo(pending) > 0) {
                        throw new IllegalArgumentException("Quantity exceeds pending for orderDetail " + od.getIdOrderDetail());
                    }

                    DeliveryItem di = new DeliveryItem();
                    di.setDelivery(delivery);
                    di.setOrderDetail(od);
                    di.setMaterial(mat);
                    di.setWarehouse(wh);
                    di.setQuantityDelivered(in.getQuantityDelivered());
                    di.setUnitPriceSnapshot(mat.getPriceArs());

                    delivery.getItems().add(di);

                    // TO-DO stockService.adjust(mat.getIdMaterial(),
                    //        (wh != null ? wh.getIdWarehouse() : null),
                    //        in.getQuantityDelivered().negate());
                }
            }
        }

        if (dto.isDeleteMissingItems()) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean owner = auth != null && auth.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_OWNER".equals(a.getAuthority()));
            if (!owner) throw new AccessDeniedException("Only OWNER can delete delivery items");

            delivery.getItems().removeIf(i -> i.getIdDeliveryItem() != null && !keepIds.contains(i.getIdDeliveryItem()));
            //TO-DO por cada ítem eliminado, reponer stock (delta = -prev → adjust con signo inverso)
        }

        // Recalcular estado del pedido y reflejar en esta entrega
        DeliveryStatus status = calculateStatusForOrder(orders.getIdOrders());
        delivery.setStatus(status);

        repoDelivery.save(delivery);
    }

    @Override
    @Transactional
    public void deleteDeliveryById(Long id) {
        Delivery delivery = repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));

        // TO-DO reponer stock por cada renglón eliminado
        //  for (DeliveryItem i : delivery.getItems())
        //   stockService.adjust(i.getMaterial().getIdMaterial(),
        //       (i.getWarehouse() != null ? i.getWarehouse().getIdWarehouse() : null),
        //       i.getQuantityDelivered()); // reponer
        // }

        repoDelivery.delete(delivery);
    }
}
