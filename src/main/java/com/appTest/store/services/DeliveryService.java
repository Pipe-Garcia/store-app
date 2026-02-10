package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.delivery.*;
import com.appTest.store.models.*;
import com.appTest.store.models.enums.DeliveryStatus;
import com.appTest.store.repositories.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;


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
    private final AuditService audit;

    // Lectura de venta/pagos para “gatear” la entrega (opcional)
    private final ISaleRepository repoSale;

    /* ==================== Queries básicas ==================== */

    @Override
    public List<Delivery> getAllDeliveries() {
        return repoDelivery.findAll(
                Sort.by(Sort.Direction.DESC, "deliveryDate", "idDelivery")
        );
    }

    @Override
    public Delivery getDeliveryById(Long id) {
        return repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));
    }

    @Override
    public List<Delivery> search(DeliveryStatus status, Long saleId, Long clientId, LocalDate from, LocalDate to) {
        return repoDelivery.search(status, saleId, clientId, from, to);
    }

    /* ============ Helpers de auditoría (Delivery) ============ */

    private Map<String,Object> snap(Delivery d){
        if (d == null) return null;
        Map<String,Object> m = new LinkedHashMap<>();
        DeliveryDTO dto = convertDeliveryToDto(d);
        m.put("id", dto.getIdDelivery());
        m.put("saleId", dto.getSaleId());
        m.put("deliveryDate", dto.getDeliveryDate());
        m.put("status", dto.getStatus());
        m.put("clientName", dto.getClientName());
        m.put("deliveredUnits", dto.getDeliveredUnits());
        return m;
    }

    private record Change(String field, Object from, Object to) {}

    private List<Change> diff(Map<String,Object> a, Map<String,Object> b){
        List<Change> out = new ArrayList<>();
        Set<String> keys = new LinkedHashSet<>();
        if (a != null) keys.addAll(a.keySet());
        if (b != null) keys.addAll(b.keySet());
        for (String k : keys){
            Object va = (a != null) ? a.get(k) : null;
            Object vb = (b != null) ? b.get(k) : null;
            if (!Objects.equals(va, vb)){
                out.add(new Change(k, va, vb));
            }
        }
        return out;
    }

    private String humanField(String k){
        return switch (k){
            case "deliveryDate"   -> "Fecha entrega";
            case "status"         -> "Estado";
            case "clientName"     -> "Cliente";
            case "deliveredUnits" -> "Unidades entregadas";
            case "saleId"         -> "Venta";
            default -> k;
        };
    }

    private String fmt(Object v){
        if (v == null || (v instanceof String s && s.isBlank())) return "—";
        if (v instanceof BigDecimal bd) return bd.stripTrailingZeros().toPlainString();
        return String.valueOf(v);
    }

    private String summarize(List<Change> changes){
        if (changes == null || changes.isEmpty()) return "OK";
        return changes.stream()
                .limit(3)
                .map(c -> humanField(c.field()) + ": " + fmt(c.from()) + " → " + fmt(c.to()))
                .collect(Collectors.joining(" · "))
                + (changes.size() > 3 ? " +" + (changes.size()-3) + " más" : "");
    }

    private void afterCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override public void afterCommit() { r.run(); }
                    }
            );
        } else {
            r.run();
        }
    }


    /* ==================== DTO mappers ==================== */

    private String buildItemsSummary(Delivery delivery, BigDecimal deliveredUnits) {
        if (delivery.getItems() == null || delivery.getItems().isEmpty()) {
            if (deliveredUnits == null || deliveredUnits.signum() == 0) {
                return "—";
            }
            String u = deliveredUnits.compareTo(BigDecimal.ONE) == 0 ? "unidad" : "unidades";
            return deliveredUnits.stripTrailingZeros().toPlainString() + " " + u;
        }

        Map<String, BigDecimal> qtyByMaterial = new LinkedHashMap<>();
        for (DeliveryItem di : delivery.getItems()) {
            if (di.getMaterial() == null) continue;
            String name = di.getMaterial().getName();
            BigDecimal q = di.getQuantityDelivered() != null ? di.getQuantityDelivered() : BigDecimal.ZERO;
            qtyByMaterial.merge(name, q, BigDecimal::add);
        }

        if (qtyByMaterial.isEmpty()) {
            if (deliveredUnits == null || deliveredUnits.signum() == 0) {
                return "—";
            }
            String u = deliveredUnits.compareTo(BigDecimal.ONE) == 0 ? "unidad" : "unidades";
            return deliveredUnits.stripTrailingZeros().toPlainString() + " " + u;
        }

        // Un solo material
        if (qtyByMaterial.size() == 1) {
            Map.Entry<String, BigDecimal> e = qtyByMaterial.entrySet().iterator().next();
            BigDecimal q = e.getValue() != null ? e.getValue() : BigDecimal.ZERO;
            String u = q.compareTo(BigDecimal.ONE) == 0 ? "unidad" : "unidades";
            return e.getKey() + " - " + q.stripTrailingZeros().toPlainString() + " " + u;
        }

        // Varios materiales
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal q : qtyByMaterial.values()) {
            if (q != null) total = total.add(q);
        }
        return qtyByMaterial.size() + " materiales (" +
                total.stripTrailingZeros().toPlainString() + " unid.)";
    }


    @Override
    public DeliveryDTO convertDeliveryToDto(Delivery delivery) {

        // 1) saleId: desde la venta asociada (si existe)
        Long saleId = (delivery.getSale() != null)
                ? delivery.getSale().getIdSale()
                : null;

        // 2) ordersId: preferimos el pedido asociado a la venta,
        //    si no está, usamos el Orders que cuelga directo de Delivery (compat legacy)
        Long orderId = null;
        if (delivery.getSale() != null && delivery.getSale().getOrders() != null) {
            orderId = delivery.getSale().getOrders().getIdOrders();
        } else if (delivery.getOrders() != null) {
            orderId = delivery.getOrders().getIdOrders();
        }

        // 3) clientName: prioridad al cliente de la venta; si no, cliente del pedido
        String clientName = "Name not found";
        if (delivery.getSale() != null && delivery.getSale().getClient() != null) {
            var c = delivery.getSale().getClient();
            clientName = (c.getName() + " " + c.getSurname()).trim();
        } else if (delivery.getOrders() != null && delivery.getOrders().getClient() != null) {
            var c = delivery.getOrders().getClient();
            clientName = (c.getName() + " " + c.getSurname()).trim();
        }

        // 4) total de unidades entregadas en ESTA entrega
        java.math.BigDecimal deliveredUnits = java.math.BigDecimal.ZERO;
        if (delivery.getItems() != null) {
            for (com.appTest.store.models.DeliveryItem di : delivery.getItems()) {
                if (di.getQuantityDelivered() != null) {
                    deliveredUnits = deliveredUnits.add(di.getQuantityDelivered());
                }
            }
        }
        if (deliveredUnits.compareTo(java.math.BigDecimal.ZERO) < 0) {
            deliveredUnits = java.math.BigDecimal.ZERO;
        }

        // 5) Resumen amigable de materiales
        String itemsSummary = buildItemsSummary(delivery, deliveredUnits);

        // 6) Usamos el constructor con saleId + ordersId
        DeliveryDTO dto = new DeliveryDTO(
                delivery.getIdDelivery(),
                saleId,
                orderId,
                delivery.getDeliveryDate(),
                delivery.getStatus().name(),
                clientName
        );
        dto.setDeliveredUnits(deliveredUnits);
        dto.setItemsSummary(itemsSummary);
        return dto;
    }


    @Override
    public DeliveryDetailDTO getDeliveryDetail(Long id) {
        Delivery d = repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));

        String clientName = (d.getSale() != null && d.getSale().getClient() != null)
                ? (d.getSale().getClient().getName() + " " + d.getSale().getClient().getSurname()).trim()
                : (d.getOrders() != null && d.getOrders().getClient() != null)
                ? (d.getOrders().getClient().getName() + " " + d.getOrders().getClient().getSurname()).trim()
                : "Name not found";

        List<DeliveryItemDTO> items = d.getItems().stream().map(i ->
                new DeliveryItemDTO(
                        i.getIdDeliveryItem(),
                        i.getOrderDetail() != null ? i.getOrderDetail().getIdOrderDetail() : null,
                        i.getMaterial().getIdMaterial(),
                        i.getMaterial().getName(),
                        i.getWarehouse() != null ? i.getWarehouse().getIdWarehouse() : null,
                        i.getWarehouse() != null ? i.getWarehouse().getName() : null,
                        // quantityOrdered: usamos OrderDetail si existe, sino la quantity de venta como referencia
                        i.getOrderDetail() != null && i.getOrderDetail().getQuantity() != null
                                ? i.getOrderDetail().getQuantity()
                                : (i.getSaleDetail() != null ? i.getSaleDetail().getQuantity() : BigDecimal.ZERO),
                        i.getQuantityDelivered(),
                        i.getUnitPriceSnapshot()
                )
        ).collect(Collectors.toList());

        BigDecimal total = items.stream()
                .map(it -> (it.getUnitPriceSnapshot() == null ? BigDecimal.ZERO : it.getUnitPriceSnapshot())
                        .multiply(it.getQuantityDelivered() == null ? BigDecimal.ZERO : it.getQuantityDelivered()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Long saleId = (d.getSale() != null ? d.getSale().getIdSale() : null);
        Long orderId = (d.getOrders() != null ? d.getOrders().getIdOrders() : null);

        return new DeliveryDetailDTO(
                d.getIdDelivery(),
                saleId,
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
    public List<DeliveryDTO> getDeliveriesBySale(Long saleId) {
        List<Delivery> list = repoDelivery.findBySale_IdSale(saleId);
        return list.stream()
                .map(this::convertDeliveryToDto)
                .collect(Collectors.toList());
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


            Long saleId = (d.getSale() != null ? d.getSale().getIdSale() : null);

            return new DeliveryDetailDTO(
                    d.getIdDelivery(),
                    saleId,
                    d.getOrders() != null ? d.getOrders().getIdOrders() : null,
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

        if (dto.getDeliveryDate() == null) {
            throw new IllegalArgumentException("Delivery date is required");
        }
        if (dto.getItems() == null || dto.getItems().isEmpty()) {
            throw new IllegalArgumentException("At least one delivery item is required.");
        }

        // === 1) Resolver la venta (nuevo eje del modelo) ===
        Sale sale = null;
        if (dto.getSaleId() != null) {
            sale = repoSale.findById(dto.getSaleId())
                    .orElseThrow(() ->
                            new EntityNotFoundException("Sale not found with ID: " + dto.getSaleId()));
        } else {
            // Para el modelo nuevo queremos SIEMPRE una venta
            throw new IllegalArgumentException("Sale ID is required to create a delivery.");
        }

        // === 2) Resolver el pedido (solo como origen / control interno) ===
        Orders orders = null;

        if (dto.getOrdersId() != null) {
            // Caso compatibilidad: si vino ordersId en el JSON, lo usamos
            orders = repoOrders.findById(dto.getOrdersId())
                    .orElseThrow(() ->
                            new EntityNotFoundException("Orders not found with ID: " + dto.getOrdersId()));
        } else if (sale.getOrders() != null) {
            // Caso modelo nuevo: derivamos el pedido desde la venta
            orders = sale.getOrders();
        }

        if (orders == null) {
            // Por ahora solo soportamos entregas para ventas que provienen de un presupuesto.
            throw new IllegalArgumentException(
                    "This sale has no associated Order. Deliveries are currently supported only for sales generated from a Presupuesto."
            );
        }

        // Coherencia: si la venta ya tiene pedido asociado, debe coincidir con el ordersId (si vino)
        if (sale.getOrders() != null &&
                !Objects.equals(sale.getOrders().getIdOrders(), orders.getIdOrders())) {
            throw new IllegalArgumentException("Sale does not belong to the given Order");
        }

        // === 3) Validar fechas (entrega no puede ser anterior al presupuesto) ===
        ensureDate(orders, dto.getDeliveryDate());

        // === 4) Exigir venta 100% paga antes de entregar (política de negocio) ===
        BigDecimal saleTotal = sale.getSaleDetailList().stream()
                .map(sd -> sd.getPriceUni().multiply(sd.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPaid = (sale.getPaymentList() == null)
                ? BigDecimal.ZERO
                : sale.getPaymentList().stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalPaid.compareTo(saleTotal) < 0) {
            throw new IllegalStateException("Delivery requires a fully paid sale.");
        }

        // === 5) Mapa: orderDetailId -> ya entregado antes de esta entrega (modelo viejo) ===
        Map<Long, BigDecimal> deliveredByDetail = loadDeliveredByDetailForOrder(orders.getIdOrders());

        // === 6) Armar la cabecera de la entrega ===
        Delivery delivery = new Delivery();
        delivery.setOrders(orders);
        delivery.setDeliveryDate(dto.getDeliveryDate());
        delivery.setStatus(DeliveryStatus.PENDING);

        // === 7) Procesar renglones ===
        for (DeliveryItemCreateDTO it : dto.getItems()) {

            if (it.getMaterialId() == null) {
                throw new IllegalArgumentException("materialId is required for each delivery item.");
            }

            BigDecimal qty = it.getQuantityDelivered();
            if (qty == null || qty.signum() <= 0) {
                throw new IllegalArgumentException("quantityDelivered must be > 0");
            }

            // Material
            Material mat = repoMaterial.findById(it.getMaterialId())
                    .orElseThrow(() ->
                            new EntityNotFoundException("Material not found: " + it.getMaterialId()));

            // === 7.a) Resolver OrderDetail (si existe), por ID o por material ===
            OrderDetail od = null;
            if (it.getOrderDetailId() != null) {
                od = repoOrderDetail.findById(it.getOrderDetailId())
                        .orElseThrow(() ->
                                new EntityNotFoundException("OrderDetail not found: " + it.getOrderDetailId()));

                // Si hay pedido asociado, validamos que coincida
                if (orders != null && !Objects.equals(od.getOrders().getIdOrders(), orders.getIdOrders())) {
                    throw new IllegalArgumentException("OrderDetail does not belong to the Delivery's Order");
                }
                if (od.getMaterial() == null ||
                        !Objects.equals(od.getMaterial().getIdMaterial(), mat.getIdMaterial())) {
                    throw new IllegalArgumentException("materialId does not match the OrderDetail material");
                }

            } else if (orders != null) {
                // Inferimos el OrderDetail solamente a efectos de trazabilidad y control (si hay pedido asociado)
                final Orders ord = orders; // efectivamente final para usar en la lambda

                od = ord.getOrderDetails().stream()
                        .filter(d -> d.getMaterial() != null &&
                                Objects.equals(d.getMaterial().getIdMaterial(), mat.getIdMaterial()))
                        .findFirst()
                        .orElseThrow(() -> new IllegalArgumentException(
                                "No OrderDetail found for material " + mat.getIdMaterial()
                                        + " in Order " + ord.getIdOrders()));
            }
            // Si orders == null y no vino orderDetailId, dejamos od = null (entrega ligada solo a venta)


            // === 7.b) No sobre-entregar vs pedido (solo si tenemos OrderDetail) ===
            if (od != null) {
                BigDecimal already = deliveredByDetail.getOrDefault(od.getIdOrderDetail(), BigDecimal.ZERO);
                if (already.add(qty).compareTo(od.getQuantity()) > 0) {
                    throw new IllegalArgumentException("Over-delivery on orderDetail " + od.getIdOrderDetail());
                }
            }

            // Depósito
            Warehouse wh = null;
            if (it.getWarehouseId() != null) {
                wh = repoWarehouse.findById(it.getWarehouseId())
                        .orElseThrow(() ->
                                new EntityNotFoundException("Warehouse not found: " + it.getWarehouseId()));
            }

            // Crear renglón de entrega
            DeliveryItem di = new DeliveryItem();
            di.setDelivery(delivery);
            di.setOrderDetail(od); // si no hay pedido asociado, puede quedar null
            di.setMaterial(mat);
            di.setWarehouse(wh);
            di.setQuantityDelivered(qty);

            // Precio snapshot: preferimos OrderDetail, si no usamos el del material
            BigDecimal snapshotPrice = (od != null && od.getPriceUni() != null)
                    ? od.getPriceUni()
                    : (mat.getPriceArs() != null ? mat.getPriceArs() : BigDecimal.ZERO);
            di.setUnitPriceSnapshot(snapshotPrice);

            delivery.getItems().add(di);

            // Actualizamos acumulado solo si hay OrderDetail
            if (od != null) {
                deliveredByDetail.merge(od.getIdOrderDetail(), qty, BigDecimal::add);
            }

        }

        // === 8) Guardar y linkear con la venta (1..N) ===

        // Primero colgamos la venta en la entrega (lado dueño de la relación)
        delivery.setSale(sale);

        // Guardamos la entrega
        Delivery saved = repoDelivery.save(delivery);

        // Mantenemos la colección de entregas de la venta coherente en memoria
        if (sale.getDeliveries() == null) {
            sale.setDeliveries(new ArrayList<>());
        }
        sale.getDeliveries().add(saved);
        repoSale.save(sale);

        // === 9) Recalcular estado global del pedido respecto de sus entregas (modelo existente) ===
        DeliveryStatus status = calculateStatusForOrder(orders.getIdOrders());
        saved.setStatus(status);
        repoDelivery.save(saved);

        DeliveryDTO dtoOut = convertDeliveryToDto(saved);

        // === Auditoría CREATE ===
        final Long did = dtoOut.getIdDelivery();
        final Map<String,Object> after = snap(saved);

        final String clientName = dtoOut.getClientName() != null ? dtoOut.getClientName() : "—";
        final BigDecimal units = dtoOut.getDeliveredUnits() != null ? dtoOut.getDeliveredUnits() : BigDecimal.ZERO;
        final Long saleId = dtoOut.getSaleId();
        final Long orderId = (saved.getOrders() != null ? saved.getOrders().getIdOrders() : null);

        StringBuilder msg = new StringBuilder();
        msg.append("Cliente: ").append(clientName)
                .append(" · Unidades: ").append(fmt(units));
        if (saleId != null)  msg.append(" · Venta #").append(saleId);
        if (orderId != null) msg.append(" · Presupuesto #").append(orderId);
        final String message = msg.toString();

        afterCommit(() -> {
            Long evId = audit.success("CREATE", "Delivery", did, message);
            Map<String,Object> diffPayload = Map.of(
                    "created", true,
                    "fields",  after
            );
            audit.attachDiff(evId, null, after, diffPayload);
        });

        return dtoOut;
    }



    /* ==================== Update (upsert) ==================== */

    @Override
    @Transactional
    public void updateDelivery(DeliveryUpdateDTO dto) {
        Delivery delivery = repoDelivery.findByIdWithGraph(dto.getIdDelivery())
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + dto.getIdDelivery()));

        Map<String,Object> before = snap(delivery);

        // Si la entrega está completada, solo permitimos cambiar fecha
        if (delivery.getStatus() == DeliveryStatus.COMPLETED) {
            if (dto.getItems() != null && !dto.getItems().isEmpty()) {
                throw new IllegalStateException("Completed deliveries cannot be modified.");
            }
            if (dto.getDeliveryDate() != null) {
                ensureDate(delivery.getOrders(), dto.getDeliveryDate());
                delivery.setDeliveryDate(dto.getDeliveryDate());
            }
            repoDelivery.save(delivery);

            Map<String,Object> after = snap(delivery);
            List<Change> changes = diff(before, after);
            String message = summarize(changes);
            final Long did = delivery.getIdDelivery();

            afterCommit(() -> {
                Long evId = audit.success("UPDATE", "Delivery", did, message);
                var changed = changes.stream()
                        .map(c -> Map.<String,Object>of(
                                "field", c.field(),
                                "from",  c.from(),
                                "to",    c.to()
                        ))
                        .collect(Collectors.toList());
                Map<String,Object> diffPayload = Map.of("changed", changed);
                audit.attachDiff(evId, before, after, diffPayload);
            });
            return;
        }

        // Actualizar fecha si viene
        if (dto.getDeliveryDate() != null) {
            ensureDate(delivery.getOrders(), dto.getDeliveryDate());
            delivery.setDeliveryDate(dto.getDeliveryDate());
        }

        // Índices para buscar ítems existentes
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
                    BigDecimal delta = next.subtract(prev); // si < 0 sería “devolver” entrega

                    if (next.signum() <= 0) {
                        throw new IllegalArgumentException("quantityDelivered must be > 0");
                    }

                    // Validaciones de sobreentrega vs pedido
                    OrderDetail od = target.getOrderDetail();
                    BigDecimal deliveredSoFar = deliveredSoFarForDetail(od.getIdOrderDetail())
                            .subtract(prev); // restamos lo que ya contaba este ítem
                    BigDecimal pending = od.getQuantity().subtract(deliveredSoFar);
                    if (next.compareTo(pending) > 0) {
                        throw new IllegalArgumentException("Quantity exceeds pending for orderDetail " + od.getIdOrderDetail());
                    }

                    // En el modelo nuevo NO tocamos stock ni reservas acá
                    if (delta.signum() < 0) {
                        // si en el futuro querés soportar devoluciones, acá habría que manejar nota de crédito, etc.
                        throw new UnsupportedOperationException("Reducing deliveries is not supported yet.");
                    }

                    target.setQuantityDelivered(next);
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

                    // Validar contra pendiente de ese OrderDetail
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
                }
            }
        }

        // Borrado de ítems que no vinieron en el update
        if (dto.isDeleteMissingItems()) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean owner = auth != null && auth.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_OWNER".equals(a.getAuthority()));
            if (!owner) throw new AccessDeniedException("Only OWNER can delete delivery items");

            delivery.getItems().removeIf(i ->
                    i.getIdDeliveryItem() != null && !keepIds.contains(i.getIdDeliveryItem()));

            // En el modelo nuevo, borrar un item de entrega NO toca stock:
            // el stock se manejó en la venta.
        }

        // Recalcular estado del pedido y reflejar en esta entrega
        DeliveryStatus status = calculateStatusForOrder(delivery.getOrders().getIdOrders());
        delivery.setStatus(status);

        repoDelivery.save(delivery);
        Map<String,Object> after = snap(delivery);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);
        final Long did = delivery.getIdDelivery();

        afterCommit(() -> {
            Long evId = audit.success("UPDATE", "Delivery", did, message);
            var changed = changes.stream()
                    .map(c -> Map.<String,Object>of(
                            "field", c.field(),
                            "from",  c.from(),
                            "to",    c.to()
                    ))
                    .collect(Collectors.toList());
            Map<String,Object> diffPayload = Map.of("changed", changed);
            audit.attachDiff(evId, before, after, diffPayload);
        });
    }


    @Override
    @Transactional
    public DeliveryDTO cancelDelivery(Long id) {
        Delivery delivery = repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));

        Map<String,Object> before = snap(delivery);

        if (delivery.getStatus() == DeliveryStatus.CANCELLED) {
            throw new IllegalStateException("Delivery is already cancelled.");
        }

        delivery.setStatus(DeliveryStatus.CANCELLED);
        repoDelivery.save(delivery);

        // Si esta entrega está ligada a un pedido, recalculamos el “status global” (según tu modelo actual)
        // y lo aplicamos a las entregas NO anuladas de ese pedido para mantener consistencia visual.
        if (delivery.getOrders() != null) {
            Long orderId = delivery.getOrders().getIdOrders();
            DeliveryStatus newStatus = calculateStatusForOrder(orderId);

            List<Delivery> all = repoDelivery.findByOrders_IdOrders(orderId);
            for (Delivery d : all) {
                if (d == null) continue;
                if (d.getStatus() == DeliveryStatus.CANCELLED) continue;
                d.setStatus(newStatus);
            }
            repoDelivery.saveAll(all);
        }

        DeliveryDTO dtoOut = convertDeliveryToDto(delivery);

        // Auditoría CANCEL
        final Long did = dtoOut.getIdDelivery();
        final Map<String,Object> after = snap(delivery);

        final String clientName = dtoOut.getClientName() != null ? dtoOut.getClientName() : "—";
        final BigDecimal units = dtoOut.getDeliveredUnits() != null ? dtoOut.getDeliveredUnits() : BigDecimal.ZERO;
        final Long saleId = dtoOut.getSaleId();
        final Long orderId = dtoOut.getOrdersId();

        StringBuilder msg = new StringBuilder();
        msg.append("Cliente: ").append(clientName)
                .append(" · Unidades: ").append(fmt(units))
                .append(" · Estado: CANCELLED");
        if (saleId != null)  msg.append(" · Venta #").append(saleId);
        if (orderId != null) msg.append(" · Presupuesto #").append(orderId);
        final String message = msg.toString();

        afterCommit(() -> {
            Long evId = audit.success("CANCEL", "Delivery", did, message);
            Map<String,Object> diffPayload = Map.of("cancelled", true);
            audit.attachDiff(evId, before, after, diffPayload);
        });

        return dtoOut;
    }

    /* ==================== Delete ==================== */

    @Override
    @Transactional
    @Auditable(entity="Delivery", action="DELETE", idParam="id")
    public void deleteDeliveryById(Long id) {
        Delivery delivery = repoDelivery.findByIdWithGraph(id)
                .orElseThrow(() -> new EntityNotFoundException("Delivery not found with id: " + id));

        // Modelo nuevo: la entrega no mueve stock, así que borrar la entrega
        // solo afecta el "histórico de lo entregado". Si quisieras que una
        // cancelación de entrega impacte stock, tendría que pasar por una
        // nota de crédito / lógica de venta, no acá.

        repoDelivery.delete(delivery);
    }

}
