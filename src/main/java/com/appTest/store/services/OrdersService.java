// src/main/java/com/appTest/store/services/OrdersService.java
package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.orderDetail.OrderDetailRequestDTO; // (create)

import com.appTest.store.dto.orders.*;
import com.appTest.store.models.Client;
import com.appTest.store.models.Material;
import com.appTest.store.models.OrderDetail;
import com.appTest.store.models.Orders;
import com.appTest.store.models.enums.DocumentStatus;
import com.appTest.store.repositories.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.appTest.store.repositories.ISaleRepository;
import com.appTest.store.models.Sale;
import com.appTest.store.models.SaleDetail;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Set;


import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.HashSet;

import static java.math.BigDecimal.ZERO;


@Service
public class OrdersService implements IOrdersService {

    @Autowired private IOrdersRepository repoOrders;
    @Autowired private IClientRepository repoClient;
    @Autowired private IMaterialRepository repoMat;
    @Autowired private IStockReservationRepository repoReservation;
    @Autowired private IDeliveryItemRepository repoDeliveryItem;
    @Autowired private ISaleRepository repoSale;

    @Autowired private AuditService audit;

    /* ========= Helpers auditoría (similar a MaterialService) ========= */

    private Map<String,Object> snap(Orders o){
        if (o == null) return null;
        Map<String,Object> map = new LinkedHashMap<>();
        map.put("id",            o.getIdOrders());
        map.put("fechaCreacion", o.getDateCreate());
        map.put("fechaEntrega",  o.getDateDelivery());

        if (o.getClient() != null){
            map.put("clienteId",     o.getClient().getIdClient());
            String name  = Optional.ofNullable(o.getClient().getName()).orElse("");
            String lname = Optional.ofNullable(o.getClient().getSurname()).orElse("");
            map.put("clienteNombre", (name + " " + lname).trim());
        } else {
            map.put("clienteId",     null);
            map.put("clienteNombre", null);
        }

        map.put("total", calculateTotal(o));
        return map;
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
            case "fechaCreacion" -> "Fecha creación";
            case "fechaEntrega"  -> "Fecha entrega";
            case "clienteNombre","clienteId" -> "Cliente";
            case "total"         -> "Total";
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

    // Ejecutar algo después del commit de la TX actual
    private void afterCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override public void afterCommit() { r.run(); }
                    }
            );
        } else {
            // fallback si no hay TX
            r.run();
        }
    }

    @Override
    public List<Orders> getAllOrders() {
        return repoOrders.findAll();
    }

    @Override
    public Orders getOrdersById(Long id) {
        return repoOrders.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Order not found with ID: " + id));
    }

    private BigDecimal calculateTotal(Orders orders) {
        return orders.getOrderDetails().stream()
                .map(od -> od.getQuantity().multiply(od.getPriceUni()))
                .reduce(ZERO, BigDecimal::add);
    }

    @Override
    public OrdersDTO convertOrdersToDto(Orders orders) {
        String nameClient = (orders.getClient() != null) ? orders.getClient().getName() : "Name not found";
        String surnameClient = (orders.getClient() != null) ? orders.getClient().getSurname() : "Surname not found";
        String completeNameClient = nameClient + " " + surnameClient;
        Long clientId = (orders.getClient() != null) ? orders.getClient().getIdClient() : null;
        BigDecimal total  = calculateTotal(orders);


        // dentro de OrdersService.convertOrdersToDto(...)
        boolean soldOut = isSoldOut(orders);

        return new OrdersDTO(
                orders.getIdOrders(),
                completeNameClient,
                clientId,
                orders.getDateCreate(),
                orders.getDateDelivery(),
                soldOut,
                total
        );

    }

    @Override
    @Transactional(readOnly = true)
    public OrdersViewDTO getOrderView(Long id) {
        Orders o = repoOrders.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Order not found: " + id));

        // === Cabecera ===
        Long clientId = (o.getClient() != null ? o.getClient().getIdClient() : null);
        String fullName = (o.getClient() != null)
                ? ((o.getClient().getName() != null ? o.getClient().getName() : "")
                + " "
                + (o.getClient().getSurname() != null ? o.getClient().getSurname() : "")).trim()
                : null;

        // 1) Renglones del pedido
        List<OrderDetail> lines = o.getOrderDetails();

        // 2) Total monetario
        java.math.BigDecimal orderTotal = lines.stream()
                .map(d -> d.getPriceUni().multiply(d.getQuantity()))
                .reduce(ZERO, java.math.BigDecimal::add);

        // 2b) Total de unidades presupuestadas
        java.math.BigDecimal totalOrderedUnits = lines.stream()
                .map(OrderDetail::getQuantity)
                .reduce(ZERO, java.math.BigDecimal::add);

        // 3) "Vendidas" = sumatoria de SaleDetail por material para este pedido
        java.util.Map<Long, java.math.BigDecimal> soldByMat = new java.util.HashMap<>();
        var sales = repoSale.findByOrders_IdOrders(o.getIdOrders());
        for (Sale s : sales) {
            if (s.getStatus() == DocumentStatus.CANCELLED) continue;

            if (s.getSaleDetailList() == null) continue;
            for (SaleDetail sd : s.getSaleDetailList()) {
                if (sd.getMaterial() == null) continue;
                Long matId = sd.getMaterial().getIdMaterial();
                java.math.BigDecimal qty = sd.getQuantity() != null ? sd.getQuantity() : ZERO;
                soldByMat.merge(matId, qty, java.math.BigDecimal::add);
            }
        }

        // 3b) “Entregadas” = DeliveryItem sumadas por renglón (orderDetailId)
        java.util.Map<Long, java.math.BigDecimal> deliveredByDetail = new java.util.HashMap<>();
        for (Object[] row : repoDeliveryItem.deliveredByOrderDetail(o.getIdOrders())) {
            Long odId = (Long) row[0];
            java.math.BigDecimal qty = (java.math.BigDecimal) row[1];
            deliveredByDetail.put(odId, qty != null ? qty : ZERO);
        }

        // 4) Armar detalle de la vista
        java.util.List<OrderDetailViewDTO> details = new java.util.ArrayList<>();
        java.math.BigDecimal totalRemainingUnits = ZERO;
        java.math.BigDecimal totalDeliveredUnits = ZERO;
        java.math.BigDecimal totalCommittedUnits = ZERO;

        for (OrderDetail d : lines) {
            Long matId = d.getMaterial().getIdMaterial();
            String matName = d.getMaterial().getName();

            java.math.BigDecimal ordered   = d.getQuantity(); // pedidas
            java.math.BigDecimal delivered = deliveredByDetail.getOrDefault(d.getIdOrderDetail(), ZERO);
            java.math.BigDecimal sold      = soldByMat.getOrDefault(matId, ZERO);

            if (delivered.compareTo(ordered) > 0) {
                delivered = ordered; // sanity
            }

            // Siempre pendiente vs pedido (no vs vendido)
            java.math.BigDecimal remaining = ordered.subtract(delivered);
            if (remaining.signum() < 0) remaining = ZERO;

            // comprometido = vendido - entregado, acotado a lo pendiente
            java.math.BigDecimal committed = sold.subtract(delivered);
            if (committed.signum() < 0) committed = ZERO;
            if (committed.compareTo(remaining) > 0) {
                committed = remaining;
            }

            totalRemainingUnits = totalRemainingUnits.add(remaining);
            totalDeliveredUnits = totalDeliveredUnits.add(delivered);
            totalCommittedUnits = totalCommittedUnits.add(committed);

            Long orderDetailId = d.getIdOrderDetail();
            details.add(new OrderDetailViewDTO(
                    orderDetailId,
                    matId,
                    matName,
                    d.getPriceUni(),
                    ordered,
                    committed,
                    delivered,
                    remaining
            ));
        }

        // === Estado de entrega global (igual que antes) ===
        boolean soldOut = (totalRemainingUnits.signum() == 0);

        // === NUEVO: totales de vendido y pendiente por vender ===

        // Consideramos sólo materiales que aparecen en el pedido
        java.util.Set<Long> matsInOrder = lines.stream()
                .filter(d -> d.getMaterial() != null && d.getMaterial().getIdMaterial() != null)
                .map(d -> d.getMaterial().getIdMaterial())
                .collect(java.util.stream.Collectors.toSet());

        java.math.BigDecimal totalSoldUnits = ZERO;
        for (Long matId : matsInOrder) {
            totalSoldUnits = totalSoldUnits.add(soldByMat.getOrDefault(matId, ZERO));
        }

        java.math.BigDecimal totalPendingToSellUnits = totalOrderedUnits.subtract(totalSoldUnits);
        if (totalPendingToSellUnits.signum() < 0) {
            totalPendingToSellUnits = ZERO;
        }

        boolean fullySold = (totalPendingToSellUnits.signum() == 0);

        // DTO base (campos originales)
        OrdersViewDTO dto = new OrdersViewDTO(
                o.getIdOrders(),
                clientId,
                fullName,
                o.getDateCreate(),
                o.getDateDelivery(),
                orderTotal,
                soldOut,
                totalRemainingUnits,
                totalDeliveredUnits,
                totalCommittedUnits,
                details
        );

        // Seteamos extras
        dto.setTotalOrderedUnits(totalOrderedUnits);
        dto.setTotalSoldUnits(totalSoldUnits);
        dto.setTotalPendingToSellUnits(totalPendingToSellUnits);
        dto.setFullySold(fullySold);

        return dto;
    }




    // metodo nuevo en OrdersService
    public List<OrderDeliveryPendingDTO> getDeliveryPending(Long orderId) {
        Orders o = repoOrders.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found: " + orderId));

        return o.getOrderDetails().stream().map(od -> {
            BigDecimal ordered = od.getQuantity();
            BigDecimal delivered = repoDeliveryItem.sumDeliveredByOrderDetail(od.getIdOrderDetail());
            BigDecimal pending = ordered.subtract(delivered);
            if (pending.signum() < 0) pending = ZERO; // sanity
            return new OrderDeliveryPendingDTO(
                    od.getIdOrderDetail(),
                    od.getMaterial().getIdMaterial(),
                    od.getMaterial().getName(),
                    ordered, delivered, pending
            );
        }).toList();
    }


    // Nuevo: mapa materialId -> ALLOCATED para este pedido
    private Map<Long, BigDecimal> loadAllocatedMap(Long orderId) {
        var rows = repoReservation.allocatedByMaterialForOrder(orderId);
        Map<Long, BigDecimal> map = new HashMap<>();
        for (Object[] r : rows) {
            Long matId = ((Number) r[0]).longValue();
            BigDecimal qty = (BigDecimal) r[1];
            map.put(matId, qty == null ? ZERO : qty);
        }
        return map;
    }

    // pending = ordered - allocated
    private BigDecimal pendingForLine(OrderDetail det, Map<Long, BigDecimal> allocatedByMat) {
        BigDecimal ordered = det.getQuantity();
        BigDecimal allocated = allocatedByMat.getOrDefault(det.getMaterial().getIdMaterial(), ZERO);
        BigDecimal pending = ordered.subtract(allocated);
        return pending.max(ZERO);
    }

    private static BigDecimal nz(BigDecimal v){ return v==null ? ZERO : v; }

    private boolean isSoldOut(Orders o){
        // total pedido
        BigDecimal totalOrdered = o.getOrderDetails().stream()
                .map(OrderDetail::getQuantity)
                .reduce(ZERO, BigDecimal::add);

        // total entregado (puede venir null si no hay entregas)
        BigDecimal totalDelivered = nz(repoDeliveryItem.sumDeliveredByOrder(o.getIdOrders()));

        // vendido = no quedan pendientes
        return totalDelivered.compareTo(totalOrdered) >= 0;
    }


    private BigDecimal remainingUnits(Orders order) {
        var map = loadAllocatedMap(order.getIdOrders());
        return order.getOrderDetails().stream()
                .map(det -> pendingForLine(det, map))
                .reduce(ZERO, BigDecimal::add);
    }


    @Override
    @Transactional
    public OrdersDTO createOrder(OrdersCreateDTO dto) {
        Orders orders = new Orders();
        orders.setDateCreate(dto.getDateCreate());
        orders.setDateDelivery(dto.getDateDelivery());

        Client client = repoClient.findById(dto.getClientId())
                .orElseThrow(() -> new EntityNotFoundException("Client not found with ID: " + dto.getClientId()));
        orders.setClient(client);

        List<OrderDetail> orderDetailList = new ArrayList<>();
        for (OrderDetailRequestDTO item : dto.getMaterials()) {
            Material material = repoMat.findById(item.getMaterialId())
                    .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + item.getMaterialId()));

            OrderDetail od = new OrderDetail();
            od.setMaterial(material);
            od.setOrders(orders);
            od.setQuantity(item.getQuantity());
            od.setPriceUni(material.getPriceArs()); // precio actual del material
            orderDetailList.add(od);
        }
        orders.setOrderDetails(orderDetailList);

        Orders saved = repoOrders.save(orders);

        // === AUDITORÍA: CREATE con mensaje humano ===
        final Long oid = saved.getIdOrders();
        final Map<String,Object> after = snap(saved);

        String name  = client.getName()    != null ? client.getName()    : "";
        String lname = client.getSurname() != null ? client.getSurname() : "";
        final String clienteNombre = (name + " " + lname).trim();
        final BigDecimal total = calculateTotal(saved);
        final String message = "Cliente: " + (clienteNombre.isBlank() ? "—" : clienteNombre)
                + " · Total: " + fmt(total);

        afterCommit(() -> {
            // Usamos acción genérica "CREATE" como en Material / Purchase
            Long evId = audit.success("CREATE", "Orders", oid, message);
            Map<String,Object> diffPayload = Map.of(
                    "created", true,
                    "fields",  after
            );
            audit.attachDiff(evId, null, after, diffPayload);
        });

        return convertOrdersToDto(saved);
    }


    @Override
    @Transactional
    public void updateOrders(OrdersUpdateDTO dto) {
        // Cargar cabecera + renglones en una sola query (evita N+1)
        Orders orders = repoOrders.findByIdWithDetails(dto.getIdOrders())
                .orElseThrow(() -> new EntityNotFoundException("Orders not found with ID: " + dto.getIdOrders()));

        // Snapshot “antes”
        Map<String,Object> before = snap(orders);

        // Cabecera
        if (dto.getDateCreate() != null) {
            orders.setDateCreate(dto.getDateCreate());
        }
        if (dto.getDateDelivery() != null) {
            if (orders.getDateCreate() != null && dto.getDateDelivery().isBefore(orders.getDateCreate())) {
                throw new IllegalArgumentException("dateDelivery cannot be before dateCreate");
            }
            orders.setDateDelivery(dto.getDateDelivery());
        }
        if (dto.getClientId() != null) {
            Client client = repoClient.findById(dto.getClientId())
                    .orElseThrow(() -> new EntityNotFoundException("Client not found with ID: " + dto.getClientId()));
            orders.setClient(client);
        }

        // Upsert de detalles (tu lógica original)
        var incoming = (dto.getDetails() == null)
                ? java.util.List.<com.appTest.store.dto.orderDetail.OrderDetailUpsertDTO>of()
                : dto.getDetails();

        var byId = orders.getOrderDetails().stream()
                .filter(d -> d.getIdOrderDetail() != null)
                .collect(Collectors.toMap(OrderDetail::getIdOrderDetail, Function.identity()));

        var byMaterial = orders.getOrderDetails().stream()
                .filter(d -> d.getMaterial() != null && d.getMaterial().getIdMaterial() != null)
                .collect(Collectors.toMap(d -> d.getMaterial().getIdMaterial(), Function.identity(), (a, b) -> a));

        var keepIds = new HashSet<Long>();

        for (var in : incoming) {
            Long inId  = in.getIdOrderDetail();
            Long matId = in.getMaterialId();

            if (inId != null && byId.containsKey(inId)) {
                // actualizar por ID de detalle
                var d = byId.get(inId);
                d.setQuantity(in.getQuantity());
                // (opcional) d.setPriceUni(d.getMaterial().getPriceArs());
                keepIds.add(d.getIdOrderDetail());
            } else {
                // evitar duplicados por material
                var existingByMat = byMaterial.get(matId);
                if (existingByMat != null) {
                    existingByMat.setQuantity(in.getQuantity());
                    // (opcional) existingByMat.setPriceUni(existingByMat.getMaterial().getPriceArs());
                    keepIds.add(existingByMat.getIdOrderDetail());
                } else {
                    Material material = repoMat.findById(matId)
                            .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + matId));
                    var d = new OrderDetail();
                    d.setOrders(orders);
                    d.setMaterial(material);
                    d.setQuantity(in.getQuantity());
                    d.setPriceUni(material.getPriceArs()); // política de precio
                    orders.getOrderDetails().add(d);
                }
            }
        }

        if (dto.isDeleteMissingDetails()) {
            orders.getOrderDetails().removeIf(d ->
                    d.getIdOrderDetail() != null && !keepIds.contains(d.getIdOrderDetail()));
        }

        repoOrders.save(orders); // cascade + orphanRemoval hacen el resto

        // Snapshot “después”
        Map<String,Object> after = snap(orders);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);

        final Long oid = orders.getIdOrders();

        afterCommit(() -> {
            Long evId = audit.success("UPDATE", "Orders", oid, message);
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
    @Auditable(entity="Orders", action="DELETE", idParam="id")
    public void deleteOrdersById(Long id) {
        repoOrders.deleteById(id);
    }

}
