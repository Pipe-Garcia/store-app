package com.appTest.store.services;

import com.appTest.store.dto.orders.OrdersCreateDTO;
import com.appTest.store.dto.orders.OrdersDTO;
import com.appTest.store.dto.orders.OrdersUpdateDTO;
import com.appTest.store.models.Orders;

import java.util.List;

public interface IOrdersService {
    public List<Orders> getAllOrders();
    public Orders getOrdersById(Long id);
    public OrdersDTO convertOrdersToDto(Orders orders);
    public OrdersDTO createOrder(OrdersCreateDTO dto);
    public void updateOrders(OrdersUpdateDTO dto);
    public void deleteOrdersById(Long id);
}
