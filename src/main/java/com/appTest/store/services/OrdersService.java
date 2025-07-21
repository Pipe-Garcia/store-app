package com.appTest.store.services;

import com.appTest.store.dto.orderDetail.OrderDetailRequestDTO;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class OrdersService implements IOrdersService{

    @Autowired
    private IOrdersRepository repoOrders;

    @Autowired
    private IClientRepository repoClient;

    @Autowired
    private IMaterialRepository repoMat;

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
                .map(orderDetail -> orderDetail.getQuantity().multiply(orderDetail.getPriceUni()))
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
            if (material != null) {
                OrderDetail od = new OrderDetail();
                od.setMaterial(material);
                od.setOrders(orders);
                od.setQuantity(item.getQuantity());
                od.setPriceUni(material.getPriceArs());

                orderDetailList.add(od);
            }
        }
        orders.setOrderDetails(orderDetailList);

        Orders savedOrders = repoOrders.save(orders);

        return convertOrdersToDto(savedOrders);
    }

    @Override
    @Transactional
    public void updateOrders(OrdersUpdateDTO dto) {
        Orders orders = repoOrders.findById(dto.getIdOrders())
                .orElseThrow(() -> new EntityNotFoundException("Orders not found with ID: " + dto.getIdOrders()));
        if (dto.getDateCreate() != null ) orders.setDateCreate(dto.getDateCreate());
        if (dto.getDateDelivery() != null) orders.setDateDelivery(dto.getDateDelivery());
        if (dto.getClientId() != null) {
            Client client = repoClient.findById(dto.getClientId())
                    .orElseThrow(() -> new EntityNotFoundException("Client not found"));
           orders.setClient(client);
        }
        repoOrders.save(orders);
    }

    @Override
    @Transactional
    public void deleteOrdersById(Long id) {
        repoOrders.deleteById(id);
    }
}
