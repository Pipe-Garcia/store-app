package com.appTest.store.controllers;

import com.appTest.store.dto.orderDetail.OrderDetailDTO;
import com.appTest.store.models.OrderDetail;
import com.appTest.store.services.IOrderDetailService;
import com.appTest.store.services.IOrdersService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/order-details")
public class OrderDetailController {

    @Autowired
    private IOrderDetailService servOrderDetail;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<OrderDetailDTO>> getAllOrderDetail() {
        List<OrderDetail> orderDetailList = servOrderDetail.getAllOrderDetail();

        List<OrderDetailDTO> orderDetailDTOList = orderDetailList.stream()
                .map( orderDetail -> servOrderDetail.convertOrderDetailToDto(orderDetail))
                .collect(Collectors.toList());

        return ResponseEntity.ok(orderDetailDTOList);
    }

    @GetMapping("/order/{ordersId}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<OrderDetailDTO>> getOrderDetailsByOrdersId(@PathVariable Long ordersId) {
        List<OrderDetail> orderDetails = servOrderDetail.getAllOrderDetail().stream()
                .filter(od -> od.getOrders().getIdOrders().equals(ordersId))
                .collect(Collectors.toList());
        List<OrderDetailDTO> dtoList = orderDetails.stream()
                .map(servOrderDetail::convertOrderDetailToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<OrderDetailDTO> getOrderDetailById(@PathVariable Long id) {
        OrderDetail orderDetail = servOrderDetail.getOrderDetailById(id);
        return ResponseEntity.ok(servOrderDetail.convertOrderDetailToDto(orderDetail));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<Void> deleteOrderDetailById(@PathVariable Long id) {
        servOrderDetail.deleteOrderDetailById(id);
        return ResponseEntity.noContent().build();
    }
}
