// src/main/java/com/appTest/store/services/OrdersService.java
package com.appTest.store.services;

import com.appTest.store.dto.orderDetail.OrderDetailRequestDTO; // (create)
import com.appTest.store.dto.orderDetail.OrderDetailUpsertDTO;  // (update)
import com.appTest.store.dto.orders.OrdersCreateDTO;
import com.appTest.store.dto.orders.OrdersDTO;
import com.appTest.store.dto.orders.OrdersUpdateDTO;
import com.appTest.store.models.Client;
import com.appTest.store.models.Material;
import com.appTest.store.models.OrderDetail;
import com.appTest.store.models.Orders;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.IOrdersRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.HashSet;


@Service
public class OrdersService implements IOrdersService {

    @Autowired private IOrdersRepository repoOrders;
    @Autowired private IClientRepository repoClient;
    @Autowired private IMaterialRepository repoMat;

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
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Override
    public OrdersDTO convertOrdersToDto(Orders orders) {
        String nameClient = (orders.getClient() != null) ? orders.getClient().getName() : "Name not found";
        String surnameClient = (orders.getClient() != null) ? orders.getClient().getSurname() : "Surname not found";
        String completeNameClient = nameClient + " " + surnameClient;
        BigDecimal total  = calculateTotal(orders);
        return new OrdersDTO(
                orders.getIdOrders(),
                completeNameClient,
                orders.getDateCreate(),
                orders.getDateDelivery(),
                total
        );
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
        return convertOrdersToDto(saved);
    }

    @Override
    @Transactional
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
    public void deleteOrdersById(Long id) {
        repoOrders.deleteById(id);
    }
}
