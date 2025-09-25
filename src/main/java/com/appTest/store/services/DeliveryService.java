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

    // Dependencias de stock / reservas (ajusta si el nombre o firma difiere en tu proyecto)
    private final IStockService stockService;
    private final IStockReservationService reservationService;

    // Lectura de venta/pagos para “gatear” la entrega (opcional)
    private final ISaleRepository repoSale;

    /* ==================== Queries básicas ==================== */

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
    public List<Delivery> search(DeliveryStatus status, Long orderId, Long clientId, LocalDate from, LocalDate to) {
        return repoDelivery.search(status, orderId, clientId, from, to);
    }

    /* ==================== DTO mappers ==================== */

    @Override
    public DeliveryDTO convertDeliveryToDto(Delivery delivery) {
        String clientName = Optional.ofNullable(delivery.getOrders())
                .map(Orders::getClient)
                .map(c -> (c.getName() + " " + c.getSurname()).trim())
                .orElse("Name not found");

        Long orderId = Optional.ofNullable(delivery.getOrders())
                .map(Orders::getIdOrders).orElse(null);

        return new DeliveryDTO(
                delivery.getIdDelivery(),
                orderId,
                delivery.getDeliveryDate(),
                delivery.getStatus().name(),
                clientName
        );
    }

    @Override
    public DeliveryDetailDTO getDeliveryDetail(Long id) {
        Delivery d = repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));

        String clientName = (d.getOrders() != null && d.getOrders().getClient() != null)
                ? (d.getOrders().getClient().getName() + " " + d.getOrders().getClient().getSurname()).trim()
                : "Name not found";

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
                .map(it -> (it.getUnitPriceSnapshot() == null ? BigDecimal.ZERO : it.getUnitPriceSnapshot())
                        .multiply(it.getQuantityDelivered() == null ? BigDecimal.ZERO : it.getQuantityDelivered()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Long orderId = (d.getOrders() != null ? d.getOrders().getIdOrders() : null);

        return new DeliveryDetailDTO(
                d.getIdDelivery(),
                orderId,
                d.getDeliveryDate(),
                d.getStatus().name(),
                clientName,
                total,
                items
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<DeliveryDTO> getDeliveriesByOrder(Long orderId) {
        List<Delivery> list = repoDelivery.findByOrders_IdOrders(orderId);
        return list.stream().map(this::convertDeliveryToDto).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<DeliveryDetailDTO> getDeliveryDetailsByOrder(Long orderId) {
        List<Delivery> list = repoDelivery.findByOrderIdWithGraph(orderId);
        return list.stream().map(d -> {
            String clientName = (d.getOrders() != null && d.getOrders().getClient() != null)
                    ? d.getOrders().getClient().getName() + " " + d.getOrders().getClient().getSurname()
                    : "Name not found";

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
        }).collect(Collectors.toList());
    }

    /* ==================== Helpers de dominio ==================== */

    private void ensureDate(Orders orders, LocalDate deliveryDate) {
        if (deliveryDate != null && orders.getDateCreate() != null
                && deliveryDate.isBefore(orders.getDateCreate())) {
            throw new IllegalArgumentException("deliveryDate cannot be before order.dateCreate");
        }
    }

    private BigDecimal deliveredSoFarForDetail(Long orderDetailId) {
        return repoDeliveryItem.sumDeliveredByOrderDetail(orderDetailId);
    }

    private Map<Long, BigDecimal> loadDeliveredByDetailForOrder(Long orderId) {
        // Construimos un mapa a partir de los OrderDetail del pedido
        Orders o = repoOrders.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Orders not found with ID: " + orderId));
        Map<Long, BigDecimal> map = new HashMap<>();
        for (OrderDetail od : o.getOrderDetails()) {
            map.put(od.getIdOrderDetail(), deliveredSoFarForDetail(od.getIdOrderDetail()));
        }
        return map;
    }

    private DeliveryStatus calculateStatusForOrder(Long orderId) {
        // Estado de la entrega respecto del pedido: PENDING / PARTIAL / COMPLETED
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

    /* ==================== Create ==================== */

    // src/main/java/com/appTest/store/services/DeliveryService.java
    @Override
    @Transactional
    public DeliveryDTO createDelivery(DeliveryCreateDTO dto) {
        Orders orders = repoOrders.findById(dto.getOrdersId())
                .orElseThrow(() -> new EntityNotFoundException("Orders not found with ID: " + dto.getOrdersId()));

        ensureDate(orders, dto.getDeliveryDate());

        Sale sale = null; // <-- mantendremos referencia si vino
        if (dto.getSaleId() != null) {
            sale = repoSale.findById(dto.getSaleId())
                    .orElseThrow(() -> new EntityNotFoundException("Sale not found with ID: " + dto.getSaleId()));

            if (sale.getOrders() == null || !Objects.equals(sale.getOrders().getIdOrders(), orders.getIdOrders())) {
                throw new IllegalArgumentException("Sale does not belong to the given Order");
            }
            // ⛔ si ya tiene entrega asociada
            if (sale.getDelivery() != null) {
                throw new IllegalStateException("This sale is already linked to delivery #" +
                        sale.getDelivery().getIdDelivery());
            }

            // exigir pago completo (si querés)
            var saleTotal = sale.getSaleDetailList().stream()
                    .map(sd -> sd.getPriceUni().multiply(sd.getQuantity()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            var totalPaid = sale.getPaymentList().stream()
                    .map(Payment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (totalPaid.compareTo(saleTotal) < 0) {
                throw new IllegalStateException("Delivery requires a fully paid sale.");
            }
        }

        if (dto.getItems() == null || dto.getItems().isEmpty()) {
            throw new IllegalArgumentException("At least one delivery item is required.");
        }

        Map<Long, BigDecimal> deliveredByDetail = loadDeliveredByDetailForOrder(orders.getIdOrders());

        Delivery delivery = new Delivery();
        delivery.setOrders(orders);
        delivery.setDeliveryDate(dto.getDeliveryDate());
        delivery.setStatus(DeliveryStatus.PENDING);

        for (DeliveryItemCreateDTO it : dto.getItems()) {
            OrderDetail od = repoOrderDetail.findById(it.getOrderDetailId())
                    .orElseThrow(() -> new EntityNotFoundException("OrderDetail not found: " + it.getOrderDetailId()));
            if (!Objects.equals(od.getOrders().getIdOrders(), orders.getIdOrders())) {
                throw new IllegalArgumentException("OrderDetail does not belong to the Delivery's Order");
            }

            Material mat = repoMaterial.findById(it.getMaterialId())
                    .orElseThrow(() -> new EntityNotFoundException("Material not found: " + it.getMaterialId()));
            if (!Objects.equals(od.getMaterial().getIdMaterial(), mat.getIdMaterial())) {
                throw new IllegalArgumentException("materialId does not match the OrderDetail material");
            }

            BigDecimal qty = it.getQuantityDelivered();
            if (qty == null || qty.signum() <= 0) {
                throw new IllegalArgumentException("quantityDelivered must be > 0");
            }

            BigDecimal already = deliveredByDetail.getOrDefault(od.getIdOrderDetail(), BigDecimal.ZERO);
            if (already.add(qty).compareTo(od.getQuantity()) > 0) {
                throw new IllegalArgumentException("Over-delivery on orderDetail " + od.getIdOrderDetail());
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
            di.setQuantityDelivered(qty);
            di.setUnitPriceSnapshot(od.getPriceUni());
            delivery.getItems().add(di);

            Long orderId = orders.getIdOrders();
            Long clientId = orders.getClient() != null ? orders.getClient().getIdClient() : null;
            Long materialId = mat.getIdMaterial();
            Long warehouseId = (wh != null ? wh.getIdWarehouse() : null);

            BigDecimal shipped = reservationService.shipFromAllocation(clientId, materialId, warehouseId, qty, orderId);
            if (shipped.compareTo(qty) < 0) {
                throw new IllegalStateException("Not enough allocated units to deliver the requested quantity.");
            }
            stockService.decreaseStock(materialId, warehouseId, qty);

            deliveredByDetail.merge(od.getIdOrderDetail(), qty, BigDecimal::add);
        }

        Delivery saved = repoDelivery.save(delivery);

        // 🔗 Linkear venta → entrega si vino saleId
        if (sale != null) {
            sale.setDelivery(saved);
            repoSale.save(sale); // persiste FK en tabla sale (delivery_id)
        }

        DeliveryStatus status = calculateStatusForOrder(orders.getIdOrders());
        saved.setStatus(status);
        repoDelivery.save(saved);

        return convertDeliveryToDto(saved);
    }



    /* ==================== Update (upsert) ==================== */

    @Override
    @Transactional
    public void updateDelivery(DeliveryUpdateDTO dto) {
        Delivery delivery = repoDelivery.findByIdWithGraph(dto.getIdDelivery())
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + dto.getIdDelivery()));

        if (delivery.getStatus() == DeliveryStatus.COMPLETED) {
            if (dto.getItems() != null && !dto.getItems().isEmpty()) {
                throw new IllegalStateException("Completed deliveries cannot be modified.");
            }
            if (dto.getDeliveryDate() != null) {
                ensureDate(delivery.getOrders(), dto.getDeliveryDate());
                delivery.setDeliveryDate(dto.getDeliveryDate());
            }
            repoDelivery.save(delivery);
            return;
        }

        if (dto.getDeliveryDate() != null) {
            ensureDate(delivery.getOrders(), dto.getDeliveryDate());
            delivery.setDeliveryDate(dto.getDeliveryDate());
        }

        // Índices
        Map<Long, DeliveryItem> byId = delivery.getItems().stream()
                .filter(i -> i.getIdDeliveryItem() != null)
                .collect(Collectors.toMap(DeliveryItem::getIdDeliveryItem, i -> i));

        Map<String, DeliveryItem> byComposite = delivery.getItems().stream()
                .collect(Collectors.toMap(
                        i -> (i.getOrderDetail().getIdOrderDetail() + "-" + i.getMaterial().getIdMaterial()),
                        i -> i, (a, b) -> a));

        Set<Long> keepIds = new HashSet<>();

        if (dto.getItems() != null) {
            for (DeliveryItemUpsertDTO in : dto.getItems()) {
                DeliveryItem target = null;

                if (in.getIdDeliveryItem() != null) {
                    target = byId.get(in.getIdDeliveryItem());
                    if (target == null) {
                        throw new EntityNotFoundException("DeliveryItem not found: " + in.getIdDeliveryItem());
                    }
                } else if (in.getOrderDetailId() != null && in.getMaterialId() != null) {
                    target = byComposite.get(in.getOrderDetailId() + "-" + in.getMaterialId());
                }

                if (target != null) {
                    // UPDATE existente
                    BigDecimal prev = target.getQuantityDelivered();
                    BigDecimal next = Optional.ofNullable(in.getQuantityDelivered()).orElse(BigDecimal.ZERO);
                    BigDecimal delta = next.subtract(prev); // si < 0 sería “devolver entrega”

                    // Validaciones de sobreentrega
                    OrderDetail od = target.getOrderDetail();
                    BigDecimal deliveredSoFar = deliveredSoFarForDetail(od.getIdOrderDetail())
                            .subtract(prev); // restamos lo que ya contaba este ítem
                    BigDecimal pending = od.getQuantity().subtract(deliveredSoFar);
                    if (next.compareTo(pending) > 0) {
                        throw new IllegalArgumentException("Quantity exceeds pending for orderDetail " + od.getIdOrderDetail());
                    }

                    target.setQuantityDelivered(next);

                    if (delta.signum() > 0) {
                        Long orderId = delivery.getOrders().getIdOrders();
                        Long clientId = delivery.getOrders().getClient() != null ? delivery.getOrders().getClient().getIdClient() : null;
                        Long materialId = target.getMaterial().getIdMaterial();
                        Long warehouseId = (target.getWarehouse() != null ? target.getWarehouse().getIdWarehouse() : null);

                        BigDecimal shipped = reservationService.shipFromAllocation(
                                clientId, materialId, warehouseId, delta, orderId
                        );
                        if (shipped.compareTo(delta) < 0) {
                            throw new IllegalStateException("Not enough allocated units to deliver this delta.");
                        }
                        stockService.decreaseStock(materialId, warehouseId, delta);
                    } else if (delta.signum() < 0) {
                        // Si querés soportar “devolver” entrega: reponer stock y mover reservas CONSUMED -> ALLOCATED
                        // stockService.increaseStock(target.getMaterial().getIdMaterial(), target.getWarehouse()!=null?target.getWarehouse().getIdWarehouse():null, delta.abs());
                        // reservationService.returnConsumedToAllocation(...);
                        throw new UnsupportedOperationException("Reducir entregas existentes no está soportado todavía.");
                    }

                    keepIds.add(target.getIdDeliveryItem());
                } else {
                    // CREATE nuevo
                    if (in.getOrderDetailId() == null || in.getMaterialId() == null) {
                        throw new IllegalArgumentException("orderDetailId and materialId are required to create a delivery item");
                    }

                    OrderDetail od = repoOrderDetail.findById(in.getOrderDetailId())
                            .orElseThrow(() -> new EntityNotFoundException("OrderDetail not found: " + in.getOrderDetailId()));
                    if (!Objects.equals(od.getOrders().getIdOrders(), delivery.getOrders().getIdOrders())) {
                        throw new IllegalArgumentException("OrderDetail does not belong to the Delivery's Order");
                    }

                    Material mat = repoMaterial.findById(in.getMaterialId())
                            .orElseThrow(() -> new EntityNotFoundException("Material not found: " + in.getMaterialId()));

                    if (!Objects.equals(od.getMaterial().getIdMaterial(), mat.getIdMaterial())) {
                        throw new IllegalArgumentException("materialId does not match the OrderDetail material");
                    }

                    Warehouse wh = null;
                    if (in.getWarehouseId() != null) {
                        wh = repoWarehouse.findById(in.getWarehouseId())
                                .orElseThrow(() -> new EntityNotFoundException("Warehouse not found: " + in.getWarehouseId()));
                    }

                    BigDecimal qty = Optional.ofNullable(in.getQuantityDelivered()).orElse(BigDecimal.ZERO);
                    if (qty.signum() <= 0) {
                        throw new IllegalArgumentException("quantityDelivered must be > 0");
                    }

                    BigDecimal deliveredSoFar = deliveredSoFarForDetail(od.getIdOrderDetail());
                    BigDecimal inThisDelivery = delivery.getItems().stream()
                            .filter(i -> i.getOrderDetail().getIdOrderDetail().equals(od.getIdOrderDetail()))
                            .map(DeliveryItem::getQuantityDelivered)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal pending = od.getQuantity().subtract(deliveredSoFar).subtract(inThisDelivery);
                    if (qty.compareTo(pending) > 0) {
                        throw new IllegalArgumentException("Quantity exceeds pending for orderDetail " + od.getIdOrderDetail());
                    }

                    DeliveryItem di = new DeliveryItem();
                    di.setDelivery(delivery);
                    di.setOrderDetail(od);
                    di.setMaterial(mat);
                    di.setWarehouse(wh);
                    di.setQuantityDelivered(qty);
                    di.setUnitPriceSnapshot(od.getPriceUni());
                    delivery.getItems().add(di);

                    Long orderId = delivery.getOrders().getIdOrders();
                    Long clientId = delivery.getOrders().getClient() != null ? delivery.getOrders().getClient().getIdClient() : null;
                    Long materialId = mat.getIdMaterial();
                    Long warehouseId = (wh != null ? wh.getIdWarehouse() : null);

                    BigDecimal shipped = reservationService.shipFromAllocation(
                            clientId, materialId, warehouseId, qty, orderId
                    );
                    if (shipped.compareTo(qty) < 0) {
                        throw new IllegalStateException("Not enough allocated units to deliver the requested quantity.");
                    }
                    stockService.decreaseStock(materialId, warehouseId, qty);
                }
            }
        }

        if (dto.isDeleteMissingItems()) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean owner = auth != null && auth.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_OWNER".equals(a.getAuthority()));
            if (!owner) throw new AccessDeniedException("Only OWNER can delete delivery items");

            delivery.getItems().removeIf(i ->
                    i.getIdDeliveryItem() != null && !keepIds.contains(i.getIdDeliveryItem()));
            // TO-DO: si borrás, considerá reponer stock / revertir reservas consumidas
        }

        // Recalcular estado del pedido y reflejar en esta entrega
        DeliveryStatus status = calculateStatusForOrder(delivery.getOrders().getIdOrders());
        delivery.setStatus(status);

        repoDelivery.save(delivery);
    }

    /* ==================== Delete ==================== */

    @Override
    @Transactional
    public void deleteDeliveryById(Long id) {
        Delivery delivery = repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));

        // TO-DO: reponer stock por cada renglón eliminado y revertir reservas si corresponde
        // for (DeliveryItem i : delivery.getItems()) { ... }

        repoDelivery.delete(delivery);
    }
}
