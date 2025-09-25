package com.appTest.store.controllers;


import com.appTest.store.dto.orders.*;
import com.appTest.store.models.Orders;
import com.appTest.store.services.IOrdersService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/orders")
public class OrdersController {

    @Autowired
    private IOrdersService servOrders;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<OrdersDTO>> getAllOrders() {
        List<Orders> ordersList = servOrders.getAllOrders();
        List<OrdersDTO> ordersDTOList  = ordersList.stream()
                .map( orders -> servOrders.convertOrdersToDto(orders))
                .collect(Collectors.toList());
        return ResponseEntity.ok(ordersDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<OrdersDTO> getOrdersById(@PathVariable Long id) {
        Orders orders = servOrders.getOrdersById(id);
        return ResponseEntity.ok(servOrders.convertOrdersToDto(orders));
    }

    @GetMapping("/{id}/view")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<OrdersViewDTO> getOrderView(@PathVariable Long id){
        return ResponseEntity.ok(servOrders.getOrderView(id));
    }

    // GET /orders/{id}/delivery-pending
    @GetMapping("/{id}/delivery-pending")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public List<OrderDeliveryPendingDTO> getDeliveryPending(@PathVariable Long id) {
        return servOrders.getDeliveryPending(id);
    }


    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<OrdersDTO> createOrder(@RequestBody @Valid OrdersCreateDTO dto) {
        OrdersDTO createdOrders = servOrders.createOrder(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdOrders);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<OrdersDTO> updateOrders(@RequestBody @Valid OrdersUpdateDTO dto) {
        servOrders.updateOrders(dto);
        Orders orders = servOrders.getOrdersById(dto.getIdOrders());
        return ResponseEntity.ok(servOrders.convertOrdersToDto(orders));
    }

    @DeleteMapping ("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<String> deleteOrdersById(@PathVariable Long id) {
        Orders orders = servOrders.getOrdersById(id);
        if (orders != null) {
            servOrders.deleteOrdersById(id);
            return ResponseEntity.ok().body("The orders has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }
}
