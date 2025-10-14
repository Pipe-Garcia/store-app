// src/main/java/com/appTest/store/services/OrdersService.java
package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.orderDetail.OrderDetailRequestDTO; // (create)

import com.appTest.store.dto.orders.*;
import com.appTest.store.models.Client;
import com.appTest.store.models.Material;
import com.appTest.store.models.OrderDetail;
import com.appTest.store.models.Orders;
import com.appTest.store.repositories.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    // En OrdersService

    @Override
    @Transactional(readOnly = true)
    public OrdersViewDTO getOrderView(Long id) {
        Orders o = repoOrders.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Order not found: " + id));

        // === Cabecera ===
        Long clientId   = (o.getClient() != null ? o.getClient().getIdClient() : null);
        String fullName = (o.getClient() != null)
                ? ( (o.getClient().getName()!=null?o.getClient().getName():"")
                + " "
                + (o.getClient().getSurname()!=null?o.getClient().getSurname():"") ).trim()
                : null;

        // 1) Traer los renglones del pedido
        // IMPORTANTE: si tu getter se llama distinto, reemplazá "getOrderDetailList()" por el tuyo
        List<OrderDetail> lines = o.getOrderDetails(); // <-- ajustá el nombre si es necesario

        // 2) Totales de pedido (si tu entidad Orders no tiene getTotal())
        java.math.BigDecimal orderTotal = lines.stream()
                .map(d -> d.getPriceUni().multiply(d.getQuantity()))
                .reduce(ZERO, java.math.BigDecimal::add);

        // 3) "Comprometidas" = ALLOCATED (reservas comprometidas)
        java.util.Map<Long, java.math.BigDecimal> allocatedByMat = new java.util.HashMap<>();
        for (Object[] row : repoReservation.allocatedByMaterialForOrder(o.getIdOrders())) {
            Long matId = (Long) row[0];
            java.math.BigDecimal qty = (java.math.BigDecimal) row[1];
            allocatedByMat.put(matId, qty != null ? qty : ZERO);
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
            java.math.BigDecimal allocated = allocatedByMat.getOrDefault(matId, ZERO);
            java.math.BigDecimal delivered = deliveredByDetail.getOrDefault(d.getIdOrderDetail(), ZERO);

            if (allocated.compareTo(ZERO) < 0) allocated = ZERO;
            if (delivered.compareTo(ordered) > 0) delivered = ordered; // sanity

            // Pendiente SIEMPRE respecto de lo entregado (no de lo comprometido)
            java.math.BigDecimal remaining = ordered.subtract(delivered);
            if (remaining.signum() < 0) remaining = ZERO;

            // Lo “comprometido visible” no debe exceder lo que queda pendiente por entregar
            java.math.BigDecimal committedToShow = allocated.min(remaining);

            totalRemainingUnits = totalRemainingUnits.add(remaining);
            totalDeliveredUnits = totalDeliveredUnits.add(delivered);
            totalCommittedUnits = totalCommittedUnits.add(committedToShow);

            Long orderDetailId = d.getIdOrderDetail();
            details.add(new OrderDetailViewDTO(
                    orderDetailId,                // orderDetailId
                    matId,                               // materialId
                    matName,                             // materialName
                    d.getPriceUni(),                     // priceUni
                    ordered,                             // quantityOrdered
                    committedToShow,                     // quantityCommitted (ALLOCATED acotado)
                    delivered,                           // quantityDelivered
                    remaining                            // remainingUnits (pedidas - entregadas)

            ));
        }

        boolean soldOut = (totalRemainingUnits.signum() == 0);

        return new OrdersViewDTO(
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
    @Auditable(action="ORDER_CREATE", entity="Orders")
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
        return convertOrdersToDto(saved);
    }

    @Override
    @Transactional
    @Auditable(entity="Orders", action="UPDATE", idParam="dto.idOrders")
    public void updateOrders(OrdersUpdateDTO dto) {
        // Cargar cabecera + renglones en una sola query (evita N+1)
        Orders orders = repoOrders.findByIdWithDetails(dto.getIdOrders())
                .orElseThrow(() -> new EntityNotFoundException("Orders not found with ID: " + dto.getIdOrders()));

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

        // Upsert de detalles
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
                // (opcional) actualizar precio a vigente: d.setPriceUni(d.getMaterial().getPriceArs());
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
    }


    @Override
    @Transactional
    @Auditable(entity="Orders", action="DELETE", idParam="id")
    public void deleteOrdersById(Long id) {
        repoOrders.deleteById(id);
    }
}
